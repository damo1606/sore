/**
 * scoring.ts
 *
 * Modelo estadístico de scoring para niveles S/R activos.
 * Combina precisión histórica (backtest) con señales live (M7) para
 * calcular P(nivel_respetado) en una escala 0-100.
 */

export interface ScoreInput {
  accuracy_pct:       number;  // backtest: % de niveles respetados (módulo/ticker)
  direction_accuracy: number;  // backtest: % dirección correcta vs M7
  m7_confidence:      number;  // snapshot: confianza del análisis (0-100)
  m7_final_score:     number;  // snapshot: score de dirección (-100 a +100)
  regime:             string;  // snapshot: 'ALCISTA' | 'BAJISTA' | 'NEUTRAL' o variantes
  level_type:         "support" | "resistance";
  distance_pct:       number;  // (|spot - level| / spot) × 100
}

export interface ScoreResult {
  probability:  number;                   // 0-100, 1 decimal
  confidence:   "ALTA" | "MEDIA" | "BAJA";
  breakdown:    Record<string, number>;   // aporte de cada feature al score final
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Detecta si el régimen es alcista, bajista o neutral.
 */
function parseRegime(regime: string): "bullish" | "bearish" | "neutral" {
  const r = regime.toLowerCase();
  if (r.includes("alc") || r.includes("bull")) return "bullish";
  if (r.includes("baj") || r.includes("bear")) return "bearish";
  return "neutral";
}

/**
 * Bonus de régimen: el nivel se alinea con el régimen dominante.
 *
 * ALCISTA + soporte     = 1.0  (soporte defendido en tendencia alcista = caso normal)
 * BAJISTA + resistencia = 1.0  (resistencia respetada en tendencia bajista = caso normal)
 * ALCISTA + resistencia = 0.6  (resistencia puede romperse hacia arriba)
 * BAJISTA + soporte     = 0.6  (soporte puede ceder en caída)
 * NEUTRAL + cualquiera  = 0.8
 */
function regimeMultiplier(regime: string, levelType: "support" | "resistance"): number {
  const r = parseRegime(regime);
  if (r === "neutral") return 0.8;
  if ((r === "bullish" && levelType === "support") ||
      (r === "bearish" && levelType === "resistance")) return 1.0;
  return 0.6;
}

/**
 * Score de distancia: penaliza niveles muy lejanos al spot actual.
 * dist < 0.5% → 100 (nivel en zona de prueba inmediata)
 * dist > 5%   → 40  (nivel demasiado lejos para ser relevante a corto plazo)
 * Interpolación lineal entre ambos extremos.
 */
function distanceScore(distPct: number): number {
  if (distPct <= 0.5) return 100;
  if (distPct >= 5.0) return 40;
  return 100 - ((distPct - 0.5) / 4.5) * 60;
}

/**
 * Alineación del score M7 con el tipo de nivel.
 * Soporte: score positivo (alcista) alinea, negativo desalinea.
 * Resistencia: score negativo (bajista) alinea, positivo desalinea.
 * Devuelve un valor 0-100 para usar como feature.
 */
function m7ScoreAlignment(m7FinalScore: number, levelType: "support" | "resistance"): number {
  // m7FinalScore va de -100 (muy bajista) a +100 (muy alcista)
  const abs = Math.abs(m7FinalScore);
  const aligned =
    (levelType === "support"    && m7FinalScore > 0) ||
    (levelType === "resistance" && m7FinalScore < 0);
  // Si alineado: más score = más convicción = mejor
  // Si desalineado: más score = más en contra = peor
  return aligned ? 50 + abs / 2 : 50 - abs / 2;
}

// ── Modelo principal ──────────────────────────────────────────────────────────

const WEIGHTS = {
  accuracy_pct:       0.28,
  m7_confidence:      0.22,
  direction_accuracy: 0.18,
  m7_score_alignment: 0.15,
  regime:             0.10,
  distance:           0.07,
};

export function scoreProbability(input: ScoreInput): ScoreResult {
  const {
    accuracy_pct,
    direction_accuracy,
    m7_confidence,
    m7_final_score,
    regime,
    level_type,
    distance_pct,
  } = input;

  // Calcular aporte de cada feature (cada uno normalizado a 0-100, luego × peso)
  const regMult     = regimeMultiplier(regime, level_type);
  const regScore    = regMult * 100; // convertir a escala 0-100
  const distS       = distanceScore(distance_pct);
  const alignScore  = m7ScoreAlignment(m7_final_score, level_type);

  const contributions = {
    accuracy:      Math.round(accuracy_pct        * WEIGHTS.accuracy_pct       * 10) / 10,
    m7_confidence: Math.round(m7_confidence       * WEIGHTS.m7_confidence      * 10) / 10,
    direction:     Math.round(direction_accuracy   * WEIGHTS.direction_accuracy * 10) / 10,
    m7_alignment:  Math.round(alignScore           * WEIGHTS.m7_score_alignment * 10) / 10,
    regime:        Math.round(regScore             * WEIGHTS.regime             * 10) / 10,
    distance:      Math.round(distS               * WEIGHTS.distance           * 10) / 10,
  };

  const raw = Object.values(contributions).reduce((a, b) => a + b, 0);
  const probability = Math.round(Math.min(99, Math.max(1, raw)) * 10) / 10;

  const confidence: ScoreResult["confidence"] =
    probability >= 65 ? "ALTA" :
    probability >= 45 ? "MEDIA" : "BAJA";

  return { probability, confidence, breakdown: contributions };
}

// ── Scoring sin backtest (solo datos M7) ─────────────────────────────────────

/**
 * Cuando no hay backtest previo, redistribuye los pesos de accuracy/direction
 * hacia m7_confidence y m7_alignment. Devuelve un ScoreInput parcial con
 * valores neutros (50) para las features faltantes.
 */
export function scoreProbabilityNoBacktest(
  m7_confidence:  number,
  m7_final_score: number,
  regime:         string,
  level_type:     "support" | "resistance",
  distance_pct:   number
): ScoreResult {
  // Sin backtest usamos 50% como prior neutro para accuracy y direction
  return scoreProbability({
    accuracy_pct:       50,
    direction_accuracy: 50,
    m7_confidence,
    m7_final_score,
    regime,
    level_type,
    distance_pct,
  });
}
