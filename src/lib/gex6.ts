import { gammaBS } from "./blackscholes";

const RISK_FREE_RATE = 0.043;
const CONTRACT_SIZE = 100;

export type RegimeType =
  | "COMPRESIÓN"
  | "TRANSICIÓN"
  | "EXPANSIÓN"
  | "PÁNICO AGUDO"
  | "CRISIS SISTÉMICA";

export type VixVelocity =
  | "ACELERANDO"
  | "SUBIENDO"
  | "ESTABLE"
  | "BAJANDO"
  | "DESACELERANDO";

export interface RegimeSignal {
  name: string;
  rawValue: number;
  normalizedScore: number; // -1 to +1  (positive = compression)
  weight: number;
  contribution: number;
  label: string;
}

export interface Analysis6Result {
  // VIX
  vix: number;
  vix3m: number;
  vixRatio: number;       // VIX / VIX3M
  vixChange1d: number;    // % change vs yesterday
  vixChange5d: number;    // % change over 5 days
  vixVelocity: VixVelocity;

  // SPY
  spySpot: number;
  spyGexTotal: number;
  spyPcr: number;

  // Signals & score
  signals: RegimeSignal[];
  regimeScore: number;    // -1 to +1

  // Verdict
  regime: RegimeType;
  signalSuspended: boolean;
  suspendedReason: string;

  // M5 adjustment
  m5Multiplier: number;
  m5AdjustmentLabel: string;
}

interface RawOption {
  strike: number;
  impliedVolatility: number;
  openInterest: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Compute total GEX and PCR for SPY (simplified, primary expiration only) */
export function computeSpyMetrics(
  calls: RawOption[],
  puts: RawOption[],
  spot: number,
  T: number
): { gexTotal: number; pcr: number } {
  let gexTotal = 0;
  let totalCallOI = 0;
  let totalPutOI = 0;

  const allStrikes = Array.from(
    new Set([...calls.map((c) => c.strike), ...puts.map((p) => p.strike)])
  );

  for (const strike of allStrikes) {
    const call = calls.find((c) => c.strike === strike);
    const put = puts.find((p) => p.strike === strike);
    const callOI = call?.openInterest ?? 0;
    const putOI = put?.openInterest ?? 0;
    const callIV = call?.impliedVolatility ?? 0;
    const putIV = put?.impliedVolatility ?? 0;

    const gCall = gammaBS(spot, strike, T, RISK_FREE_RATE, callIV);
    const gPut = gammaBS(spot, strike, T, RISK_FREE_RATE, putIV);
    gexTotal +=
      callOI * gCall * spot * spot * CONTRACT_SIZE -
      putOI * gPut * spot * spot * CONTRACT_SIZE;

    totalCallOI += callOI;
    totalPutOI += putOI;
  }

  const pcr = totalCallOI > 0 ? totalPutOI / totalCallOI : 1;
  return { gexTotal, pcr };
}

export function computeRegime(
  vix: number,
  vix3m: number,
  vixHistory: number[], // daily closes oldest→newest (includes today as last)
  spyGexTotal: number,
  spyPcr: number,
  spySpot: number,
): Analysis6Result {
  // ── VIX velocity ────────────────────────────────────────────────────────
  const oldest = vixHistory[0] ?? vix;
  const prev   = vixHistory.length >= 2 ? vixHistory[vixHistory.length - 2] : vix;

  const vixChange5d = oldest > 0 ? ((vix - oldest) / oldest) * 100 : 0;
  const vixChange1d = prev   > 0 ? ((vix - prev)   / prev)   * 100 : 0;
  const vixRatio    = vix3m  > 0 ? vix / vix3m : 1;

  let vixVelocity: VixVelocity;
  if (vixChange5d > 30)       vixVelocity = "ACELERANDO";
  else if (vixChange5d > 5)   vixVelocity = "SUBIENDO";
  else if (vixChange5d < -20) vixVelocity = "DESACELERANDO";
  else if (vixChange5d < -5)  vixVelocity = "BAJANDO";
  else                        vixVelocity = "ESTABLE";

  // ── Panic/crisis early detection (overrides score) ──────────────────────
  const isCrisis = vix > 50;
  const isPanic  = vix > 35 || (vix > 28 && vixChange5d > 40);

  // ── Signal 1: VIX nivel (35%) ────────────────────────────────────────────
  const vixScore =
    vix < 15 ?  1.0 :
    vix < 20 ?  0.5 :
    vix < 25 ?  0.0 :
    vix < 35 ? -0.5 : -1.0;

  const vixLabel =
    vix < 15 ? `VIX ${vix.toFixed(1)} — compresión extrema, entorno ideal para GEX` :
    vix < 20 ? `VIX ${vix.toFixed(1)} — compresión moderada, señales de opciones fiables` :
    vix < 25 ? `VIX ${vix.toFixed(1)} — zona de transición, cautela con niveles de opciones` :
    vix < 35 ? `VIX ${vix.toFixed(1)} — expansión, GEX menos predecible, stops más amplios` :
               `VIX ${vix.toFixed(1)} — PÁNICO, los modelos de opciones pierden validez estructural`;

  // ── Signal 2: Estructura de plazos VIX/VIX3M (25%) ──────────────────────
  const termScore =
    vixRatio < 0.85 ?  1.0 :
    vixRatio < 0.95 ?  0.5 :
    vixRatio < 1.05 ?  0.0 :
    vixRatio < 1.20 ? -0.5 : -1.0;

  const termLabel =
    vixRatio < 0.95
      ? `Contango profundo (ratio ${vixRatio.toFixed(2)}) — mercado descuenta calma en el corto plazo`
      : vixRatio < 1.05
      ? `Curva plana (ratio ${vixRatio.toFixed(2)}) — mercado incierto sobre el plazo de volatilidad`
      : `Backwardation (ratio ${vixRatio.toFixed(2)}) — mercado paga más por protección inmediata que a 3 meses — señal de miedo`;

  // ── Signal 3: SPY GEX total (30%) ────────────────────────────────────────
  const spyGexScore = spyGexTotal > 0 ? 1.0 : -1.0;
  const spyGexLabel =
    spyGexTotal > 0
      ? `GEX SPY +$${(spyGexTotal / 1e9).toFixed(1)}B — dealers largos gamma, amortiguan caídas y compresión de rango`
      : `GEX SPY −$${(Math.abs(spyGexTotal) / 1e9).toFixed(1)}B — dealers cortos gamma, amplifican movimientos en ambas direcciones`;

  // ── Signal 4: SPY PCR (10%) ──────────────────────────────────────────────
  const pcrScore =
    spyPcr < 0.7  ?  0.5 :
    spyPcr < 1.0  ?  0.0 :
    spyPcr < 1.5  ? -0.5 : -1.0;

  const pcrLabel =
    spyPcr < 0.7  ? `PCR SPY ${spyPcr.toFixed(2)} — complacencia especulativa, mercado sin cobertura bajista` :
    spyPcr < 1.0  ? `PCR SPY ${spyPcr.toFixed(2)} — posicionamiento equilibrado, sin sesgo extremo` :
    spyPcr < 1.5  ? `PCR SPY ${spyPcr.toFixed(2)} — cobertura bajista elevada, institucionales en guardia` :
                    `PCR SPY ${spyPcr.toFixed(2)} — hedging masivo de SPY, señal de miedo institucional`;

  const signals: RegimeSignal[] = [
    { name: "VIX NIVEL",       rawValue: vix,         normalizedScore: vixScore,   weight: 0.35, contribution: vixScore   * 0.35, label: vixLabel   },
    { name: "TERM STRUCTURE",  rawValue: vixRatio,    normalizedScore: termScore,  weight: 0.25, contribution: termScore  * 0.25, label: termLabel  },
    { name: "SPY GEX",         rawValue: spyGexTotal, normalizedScore: spyGexScore,weight: 0.30, contribution: spyGexScore* 0.30, label: spyGexLabel},
    { name: "SPY PCR",         rawValue: spyPcr,      normalizedScore: pcrScore,   weight: 0.10, contribution: pcrScore   * 0.10, label: pcrLabel   },
  ];

  const regimeScore = clamp(
    signals.reduce((sum, s) => sum + s.contribution, 0),
    -1, 1
  );

  // ── Regime verdict ───────────────────────────────────────────────────────
  let regime: RegimeType;
  let signalSuspended = false;
  let suspendedReason = "";

  if (isCrisis) {
    regime = "CRISIS SISTÉMICA";
    signalSuspended = true;
    suspendedReason = `VIX en ${vix.toFixed(1)} — modo supervivencia, modelos de GEX no aplicables en crisis sistémica`;
  } else if (isPanic) {
    regime = "PÁNICO AGUDO";
    signalSuspended = true;
    suspendedReason = `VIX en ${vix.toFixed(1)}${vixChange5d > 20 ? ` (+${vixChange5d.toFixed(0)}% en 5 días)` : ""} — opciones bajo presión extrema de cobertura masiva`;
  } else if (regimeScore > 0.3) {
    regime = "COMPRESIÓN";
  } else if (regimeScore < -0.3) {
    regime = "EXPANSIÓN";
  } else {
    regime = "TRANSICIÓN";
  }

  // ── M5 adjustment ────────────────────────────────────────────────────────
  let m5Multiplier: number;
  let m5AdjustmentLabel: string;

  switch (regime) {
    case "CRISIS SISTÉMICA":
      m5Multiplier = 0;
      m5AdjustmentLabel = "SEÑAL SUSPENDIDA — no operar basado en GEX durante crisis sistémica";
      break;
    case "PÁNICO AGUDO":
      m5Multiplier = 0.3;
      m5AdjustmentLabel = "Score M5 ajustado ×0.3 — GEX pierde fiabilidad en pánico, esperar normalización del VIX";
      break;
    case "EXPANSIÓN":
      m5Multiplier = 0.7;
      m5AdjustmentLabel = "Score M5 ajustado ×0.7 — entorno expansivo, los niveles S/R se rompen con mayor frecuencia";
      break;
    case "TRANSICIÓN":
      m5Multiplier = 1.0;
      m5AdjustmentLabel = "Score M5 sin ajuste — régimen de transición, monitorear señales adicionales antes de operar";
      break;
    default: // COMPRESIÓN
      m5Multiplier = 1.2;
      m5AdjustmentLabel = "Score M5 ajustado ×1.2 — compresión favorece la adherencia a niveles institucionales";
  }

  return {
    vix, vix3m, vixRatio, vixChange1d, vixChange5d, vixVelocity,
    spySpot, spyGexTotal, spyPcr,
    signals, regimeScore,
    regime, signalSuspended, suspendedReason,
    m5Multiplier, m5AdjustmentLabel,
  };
}
