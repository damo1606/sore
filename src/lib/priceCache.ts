/**
 * priceCache.ts
 *
 * Fetches OHLC daily prices from Yahoo Finance and caches them in Supabase.
 * TTL = 4 hours. Handles split detection and level adjustment.
 */

import { supabaseServer } from "@/lib/supabase";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

const CACHE_TTL_HOURS = 4;

export interface DayPrice {
  date:   string; // YYYY-MM-DD
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface SplitEvent {
  date:  string;
  ratio: number; // e.g. 0.5 for 2:1 split (price halved)
}

// ── Yahoo Finance helpers ─────────────────────────────────────────────────────

async function getYahooCredentials(): Promise<{ crumb: string; cookie: string }> {
  const res1 = await fetch("https://fc.yahoo.com", { headers: HEADERS, redirect: "follow" });
  const setCookie = res1.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(",").map((c) => c.split(";")[0].trim()).join("; ");
  const res2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...HEADERS, Cookie: cookie },
  });
  if (!res2.ok) throw new Error(`Crumb failed (${res2.status})`);
  const crumb = await res2.text();
  if (!crumb || crumb.includes("<")) throw new Error("Invalid crumb");
  return { crumb, cookie };
}

async function fetchYahooPrices(
  ticker: string,
  cookie: string,
  crumb: string,
  range = "6mo"
): Promise<{ prices: DayPrice[]; splits: SplitEvent[] }> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}&events=splits&crumb=${crumb}`;
  const res = await fetch(url, { headers: { ...HEADERS, Cookie: cookie }, cache: "no-store" });
  if (!res.ok) throw new Error(`Yahoo chart ${res.status} for ${ticker}`);

  const json  = await res.json();
  const chart = json?.chart?.result?.[0];
  if (!chart) throw new Error(`No chart data for ${ticker}`);

  const timestamps: number[]           = chart.timestamp ?? [];
  const quotes    = chart.indicators?.quote?.[0] ?? {};
  const opens:  (number | null)[]      = quotes.open   ?? [];
  const highs:  (number | null)[]      = quotes.high   ?? [];
  const lows:   (number | null)[]      = quotes.low    ?? [];
  const closes: (number | null)[]      = quotes.close  ?? [];
  const volumes:(number | null)[]      = quotes.volume ?? [];

  // Yahoo devuelve precios AJUSTADOS por splits — usamos adjclose si existe para consistencia
  const adjCloses: (number | null)[] = chart.indicators?.adjclose?.[0]?.adjclose ?? closes;

  const prices: DayPrice[] = timestamps
    .map((ts, i) => ({
      date:   new Date(ts * 1000).toISOString().split("T")[0],
      open:   opens[i]   ?? 0,
      high:   highs[i]   ?? 0,
      low:    lows[i]    ?? 0,
      close:  adjCloses[i] ?? closes[i] ?? 0,
      volume: volumes[i] ?? 0,
    }))
    .filter((d) => d.high > 0 && d.low > 0 && d.close > 0);

  // Extraer eventos de split
  const splitData = chart.events?.splits ?? {};
  const splits: SplitEvent[] = Object.values(splitData).map((s: any) => ({
    date:  new Date(s.date * 1000).toISOString().split("T")[0],
    ratio: s.denominator / s.numerator, // e.g. NVDA 10:1 → ratio=0.1 (precio cae a 1/10)
  }));

  return { prices, splits };
}

// ── Caché en Supabase ─────────────────────────────────────────────────────────

async function getCachedPrices(ticker: string): Promise<DayPrice[] | null> {
  const db = supabaseServer();

  // Verificar si la caché está vigente (última fila del ticker)
  const { data: latest } = await db
    .from("price_cache")
    .select("fetched_at")
    .eq("ticker", ticker)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();

  if (!latest) return null;

  const age = (Date.now() - new Date(latest.fetched_at).getTime()) / 3600000;
  if (age > CACHE_TTL_HOURS) return null; // expirado

  // Caché vigente — devolver todos los precios
  const { data } = await db
    .from("price_cache")
    .select("date, open, high, low, close, volume")
    .eq("ticker", ticker)
    .order("date", { ascending: true });

  if (!data?.length) return null;

  return data.map((r) => ({
    date:   r.date,
    open:   r.open  ?? 0,
    high:   r.high  ?? 0,
    low:    r.low   ?? 0,
    close:  r.close ?? 0,
    volume: r.volume ?? 0,
  }));
}

async function upsertPriceCache(ticker: string, prices: DayPrice[]): Promise<void> {
  const db = supabaseServer();
  const rows = prices.map((p) => ({ ticker, ...p, fetched_at: new Date().toISOString() }));

  // Upsert en lotes de 200 para no exceder el límite de Supabase
  for (let i = 0; i < rows.length; i += 200) {
    await db.from("price_cache").upsert(rows.slice(i, i + 200), { onConflict: "ticker,date" });
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Devuelve precios diarios del ticker. Usa caché de Supabase si está vigente.
 * También devuelve los splits detectados en el período.
 */
export async function getPrices(ticker: string): Promise<{ prices: DayPrice[]; splits: SplitEvent[] }> {
  // Intentar desde caché
  const cached = await getCachedPrices(ticker);
  if (cached) return { prices: cached, splits: [] };

  // Caché expirada o vacía → fetch Yahoo Finance
  const { crumb, cookie } = await getYahooCredentials();
  const { prices, splits } = await fetchYahooPrices(ticker, cookie, crumb, "6mo");

  // Guardar en caché (fire-and-forget)
  upsertPriceCache(ticker, prices).catch(() => {});

  return { prices, splits };
}

/**
 * Ajusta un nivel de precio almacenado si hubo splits entre snapshotDate y hoy.
 * Cada split multiplica el nivel por su ratio (precio post-split = precio × ratio).
 */
export function adjustLevelForSplits(
  level: number,
  snapshotDate: string,
  splits: SplitEvent[]
): number {
  let adjusted = level;
  for (const split of splits) {
    if (split.date > snapshotDate) {
      adjusted = adjusted * split.ratio;
    }
  }
  return adjusted;
}

/**
 * Construye un mapa fecha → DayPrice para lookups O(1).
 */
export function buildPriceMap(prices: DayPrice[]): Map<string, DayPrice> {
  return new Map(prices.map((p) => [p.date, p]));
}

/**
 * Devuelve el índice del primer precio >= a la fecha dada.
 */
export function findPriceIndex(prices: DayPrice[], fromDate: string): number {
  return prices.findIndex((p) => p.date >= fromDate);
}
