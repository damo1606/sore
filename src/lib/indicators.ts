/**
 * indicators.ts
 *
 * Indicadores técnicos para el motor de backtesting.
 * ATR-14, dynamic threshold por volatilidad, clasificación de niveles.
 */

import type { DayPrice } from "@/lib/priceCache";

// ── ATR (Average True Range) ──────────────────────────────────────────────────

/**
 * Calcula el True Range de un día dado el precio anterior de cierre.
 * TR = max(high-low, |high-prevClose|, |low-prevClose|)
 */
function trueRange(day: DayPrice, prevClose: number): number {
  return Math.max(
    day.high - day.low,
    Math.abs(day.high - prevClose),
    Math.abs(day.low  - prevClose)
  );
}

/**
 * Calcula ATR-14 usando Wilder smoothing a partir de un array de precios diarios.
 * Devuelve el ATR en el último día o en la fecha más cercana a `asOfDate`.
 */
export function calculateATR14(prices: DayPrice[], asOfDate: string): number {
  const relevantPrices = prices.filter((p) => p.date <= asOfDate);
  if (relevantPrices.length < 2) return 0;

  // Necesitamos al menos 15 días para ATR-14 (14 TRs + 1 seed)
  const window = relevantPrices.slice(-16);
  if (window.length < 2) return 0;

  // Primer ATR: simple average de los primeros 14 TRs
  const trs: number[] = [];
  for (let i = 1; i < window.length; i++) {
    trs.push(trueRange(window[i], window[i - 1].close));
  }

  if (trs.length < 14) {
    // No hay suficientes datos — usar promedio de lo disponible
    return trs.reduce((a, b) => a + b, 0) / trs.length;
  }

  // Wilder smoothing: ATR = (prevATR × 13 + currentTR) / 14
  let atr = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
  for (let i = 14; i < trs.length; i++) {
    atr = (atr * 13 + trs[i]) / 14;
  }
  return atr;
}

// ── Dynamic threshold ─────────────────────────────────────────────────────────

/**
 * Calcula el threshold dinámico de "breach" basado en la volatilidad del ticker.
 *
 * threshold = max(MIN_PCT, MULTIPLIER × ATR / spot)
 *
 * Un ticker de alta volatilidad (NVDA, TSLA) tendrá un threshold más amplio
 * que uno de baja volatilidad (SPY, QQQ).
 *
 * - MIN_PCT = 0.008 (0.8%) — mínimo para tickers muy estables
 * - MULTIPLIER = 0.6 — fracción del ATR que define la zona de tolerancia
 */
export function dynamicBreachThreshold(atr14: number, spot: number): number {
  const MIN_PCT    = 0.008;
  const MULTIPLIER = 0.6;
  if (!spot || !atr14) return MIN_PCT;
  return Math.max(MIN_PCT, (MULTIPLIER * atr14) / spot);
}

/**
 * Zona de "test" — el precio se considera que testeó el nivel si se acercó
 * dentro de 2×ATR del nivel.
 */
export function testZoneThreshold(atr14: number, spot: number): number {
  const MIN_PCT = 0.02; // 2% mínimo
  if (!spot || !atr14) return MIN_PCT;
  return Math.max(MIN_PCT, (2 * atr14) / spot);
}

// ── Ventana de evaluación por módulo ─────────────────────────────────────────

export const MODULE_WINDOWS: Record<string, number> = {
  M1: 3, // GEX de vencimiento próximo — relevante días
  M2: 5, // Z-score — horizonte semanal
  M3: 5, // Multi-expiración — horizonte semanal
  M5: 7, // Composite — horizonte hasta 2 semanas
};

// ── Evaluación de un nivel ────────────────────────────────────────────────────

export interface LevelEvaluation {
  was_tested:        boolean;
  respected:         boolean | null; // null si no fue testeado
  breach_pct:        number | null;  // positivo = perforado, negativo = respetado
  first_test_date:   string | null;
  direction_correct: boolean | null; // vs veredicto M7
}

/**
 * Evalúa si un nivel S/R fue respetado en la ventana de días posteriores al snapshot.
 *
 * Para soporte: respetado si el low de ningún día perforó más de threshold.
 * Para resistencia: respetado si el high de ningún día superó más de threshold.
 * was_tested: el precio se acercó a menos de testZone del nivel en algún día.
 * direction_correct: el nivel respetado coincide con el veredicto M7.
 */
export function evaluateLevel(
  levelPrice:    number,
  levelType:     "support" | "resistance",
  nextDays:      DayPrice[],
  atr14:         number,
  spot:          number,
  m7Verdict:     string | null
): LevelEvaluation {
  if (!nextDays.length) {
    return { was_tested: false, respected: null, breach_pct: null, first_test_date: null, direction_correct: null };
  }

  const breachThreshold = dynamicBreachThreshold(atr14, spot);
  const testZone        = testZoneThreshold(atr14, spot);

  let was_tested      = false;
  let respected       = true;
  let first_test_date: string | null = null;
  let worst_breach    = 0; // máxima perforación (en %)

  for (const day of nextDays) {
    if (levelType === "support") {
      const distToLevel = (levelPrice - day.low) / levelPrice; // positivo si low < level
      if (distToLevel >= 0 && !was_tested) {
        // El precio bajó hasta el nivel (o lo tocó)
        const proximity = Math.abs(day.low - levelPrice) / levelPrice;
        if (proximity <= testZone) {
          was_tested = true;
          first_test_date = first_test_date ?? day.date;
        }
      }
      if (day.low < levelPrice * (1 - breachThreshold)) {
        // Perforación confirmada
        respected = false;
        const breach = (levelPrice - day.low) / levelPrice;
        if (breach > worst_breach) worst_breach = breach;
        was_tested = true;
        first_test_date = first_test_date ?? day.date;
      }
    } else {
      // resistance
      const distToLevel = (day.high - levelPrice) / levelPrice;
      if (distToLevel >= 0 && !was_tested) {
        const proximity = Math.abs(day.high - levelPrice) / levelPrice;
        if (proximity <= testZone) {
          was_tested = true;
          first_test_date = first_test_date ?? day.date;
        }
      }
      if (day.high > levelPrice * (1 + breachThreshold)) {
        respected = false;
        const breach = (day.high - levelPrice) / levelPrice;
        if (breach > worst_breach) worst_breach = breach;
        was_tested = true;
        first_test_date = first_test_date ?? day.date;
      }
    }
  }

  // Si no fue testeado, respected es indeterminado
  const finalRespected = was_tested ? respected : null;
  const breach_pct     = was_tested ? (respected ? -worst_breach : worst_breach) : null;

  // direction_correct: soporte respetado en tendencia alcista = correcto
  // resistencia respetada en tendencia bajista = correcto
  let direction_correct: boolean | null = null;
  if (finalRespected !== null && m7Verdict) {
    const isBullish = m7Verdict.toLowerCase().includes("alc") || m7Verdict.toLowerCase().includes("bull");
    const isBearish = m7Verdict.toLowerCase().includes("baj") || m7Verdict.toLowerCase().includes("bear");
    if (levelType === "support"    && isBullish && finalRespected)  direction_correct = true;
    if (levelType === "support"    && isBearish && !finalRespected) direction_correct = true;
    if (levelType === "resistance" && isBearish && finalRespected)  direction_correct = true;
    if (levelType === "resistance" && isBullish && !finalRespected) direction_correct = true;
    if (direction_correct === null) direction_correct = false;
  }

  return { was_tested, respected: finalRespected, breach_pct, first_test_date, direction_correct };
}
