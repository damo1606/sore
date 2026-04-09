/**
 * fred.ts
 *
 * Fuente primaria de datos macro para M6:
 *   - VIXCLS        → VIX nivel + historial (reemplaza ^VIX de Yahoo)
 *   - VXVCLS        → VIX 3 meses (reemplaza ^VIX3M de Yahoo)
 *   - BAMLH0A0HYM2  → HYG OAS spread en bps (reemplaza HYG precio de Yahoo)
 *
 * FRED es la API pública de la Fed de St. Louis. Sin rate limit agresivo,
 * sin bloqueos por IP, datos oficiales de la misma fuente que los mercados usan.
 *
 * Requiere: FRED_API_KEY en variables de entorno.
 * API key gratuita en: https://fred.stlouisfed.org/docs/api/api_key.html
 */

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

async function fetchSeries(seriesId: string, limit = 10): Promise<number[]> {
  const key = process.env.FRED_API_KEY;
  if (!key) return [];

  const url =
    `${FRED_BASE}?series_id=${seriesId}` +
    `&api_key=${key}` +
    `&limit=${limit}` +
    `&sort_order=desc` +
    `&file_type=json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.observations ?? [])
      .filter((o: any) => o.value !== ".")   // FRED usa "." para datos faltantes
      .map((o: any) => parseFloat(o.value))
      .reverse();                            // oldest → newest
  } catch {
    return [];
  }
}

export interface FredMacro {
  vix:         number;
  vixHistory:  number[];   // últimos 10 días oldest → newest
  vix3m:       number;
  hygChange5d: number;     // negado: spread sube (+OAS) → hygChange negativo → fear score sube
  source:      "FRED";
}

/**
 * Obtiene datos macro desde FRED.
 * Devuelve null si FRED_API_KEY no está configurada o si la API falla.
 * En ese caso analysis7 usa Yahoo Finance como fallback.
 */
export async function fetchFredMacro(): Promise<FredMacro | null> {
  const [vixArr, vix3mArr, oasArr] = await Promise.all([
    fetchSeries("VIXCLS",       10),   // VIX diario — últimos 10 días
    fetchSeries("VXVCLS",       5),    // CBOE VXV 3M — últimos 5 días
    fetchSeries("BAMLH0A0HYM2", 7),    // ICE BofA HY OAS — últimos 7 días
  ]);

  if (!vixArr.length) return null;

  const vix        = vixArr[vixArr.length - 1];
  const vixHistory = vixArr;
  const vix3m      = vix3mArr.length
    ? vix3mArr[vix3mArr.length - 1]
    : vix * 1.05;   // fallback estimado si VXVCLS no responde

  // OAS spread: unidad = bps. Más spread = más miedo en crédito.
  // Se invierte vs precio HYG: spread +1% → hygChange5d -1% → computeFearScore baja
  const oasFirst    = oasArr[0] ?? 0;
  const oasLast     = oasArr[oasArr.length - 1] ?? oasFirst;
  const hygChange5d = oasFirst > 0
    ? -((oasLast - oasFirst) / oasFirst) * 100
    : 0;

  return { vix, vixHistory, vix3m, hygChange5d, source: "FRED" };
}
