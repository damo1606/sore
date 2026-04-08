/**
 * GET /api/scanner/proximity?min_age_days=30&tickers=X,Y
 *
 * Scanner de proximidad S/R con umbral dinámico por ticker:
 *   zona = max(1.5%, 0.5 × ATR14 / spot)
 *
 * Cada ticker tiene su propia zona de alerta según su volatilidad real.
 * ATR se lee de backtest_results; si no hay backtest usa fallback de 2%.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

const MIN_PCT      = 0.015; // 1.5% mínimo para tickers estables
const ATR_MULT     = 0.5;   // 0.5 × ATR = zona de medio movimiento diario
const FALLBACK_PCT = 0.02;  // 2% si no hay ATR disponible

function dynamicThresholdPct(atr14: number, spot: number): number {
  if (!atr14 || !spot) return FALLBACK_PCT;
  return Math.max(MIN_PCT, (ATR_MULT * atr14) / spot);
}

async function fetchBatchPrices(tickers: string[]): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  const BATCH = 50;
  for (let i = 0; i < tickers.length; i += BATCH) {
    const symbols = tickers.slice(i, i + BATCH).join(",");
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=regularMarketPrice`;
      const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
      if (!res.ok) continue;
      const json   = await res.json();
      const quotes = json?.quoteResponse?.result ?? [];
      for (const q of quotes) {
        if (q.regularMarketPrice) results[q.symbol] = q.regularMarketPrice;
      }
    } catch {}
    if (i + BATCH < tickers.length) await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}

function extractLevels(snap: any): { module: string; level_type: "support" | "resistance"; level: number }[] {
  const pairs: [string, "support" | "resistance", number | null][] = [
    ["M1", "support",    snap.m1_support],
    ["M1", "resistance", snap.m1_resistance],
    ["M2", "support",    snap.m2_support],
    ["M2", "resistance", snap.m2_resistance],
    ["M3", "support",    snap.m3_support],
    ["M3", "resistance", snap.m3_resistance],
    ["M5", "support",    snap.m5_support_strike],
    ["M5", "resistance", snap.m5_resistance_strike],
  ];
  return pairs
    .filter(([, , v]) => v != null && v > 0)
    .map(([module, level_type, level]) => ({ module, level_type: level_type as "support" | "resistance", level: level! }));
}

export async function GET(req: NextRequest) {
  const minAgeDays    = parseInt(req.nextUrl.searchParams.get("min_age_days") ?? "0", 10);
  const tickersParam  = req.nextUrl.searchParams.get("tickers");
  const filterTickers = tickersParam ? tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean) : null;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - minAgeDays);
  const cutoff = cutoffDate.toISOString();

  const db = supabaseServer();

  // ── 1. Snapshots confirmados ────────────────────────────────────────────────
  let query = db
    .from("sr_snapshots")
    .select("ticker, created_at, spot, m7_regime, m7_final_verdict, m7_confidence, m7_final_score, m1_support, m1_resistance, m2_support, m2_resistance, m3_support, m3_resistance, m5_support_strike, m5_resistance_strike")
    .lte("created_at", cutoff)
    .order("created_at", { ascending: false });

  if (filterTickers?.length) query = query.in("ticker", filterTickers);

  const { data: snapshots, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!snapshots?.length) return NextResponse.json({
    alerts: [], tickers_scanned: 0,
    message: `Sin snapshots con más de ${minAgeDays} días de antigüedad`,
  });

  const byTicker = new Map<string, typeof snapshots[0]>();
  for (const snap of snapshots) {
    if (!byTicker.has(snap.ticker)) byTicker.set(snap.ticker, snap);
  }

  const confirmedSnaps = Array.from(byTicker.values());
  const tickers        = confirmedSnaps.map((s) => s.ticker);

  // ── 2. ATR por ticker desde backtest_results ────────────────────────────────
  const { data: btRows } = await db
    .from("backtest_results")
    .select("ticker, atr14")
    .in("ticker", tickers)
    .gt("atr14", 0);

  const atrByTicker: Record<string, number> = {};
  for (const row of (btRows ?? [])) {
    if (!atrByTicker[row.ticker]) atrByTicker[row.ticker] = row.atr14;
  }

  // ── 3. Precios actuales en batch ─────────────────────────────────────────────
  const currentPrices = await fetchBatchPrices(tickers);

  // ── 4. Proximidad con umbral dinámico por ticker ─────────────────────────────
  const alerts: {
    ticker:         string;
    spot_current:   number;
    level:          number;
    level_type:     "support" | "resistance";
    module:         string;
    distance_usd:   number;
    distance_pct:   number;
    threshold_pct:  number;
    atr14:          number | null;
    level_age_days: number;
    regime:         string | null;
    m7_verdict:     string | null;
    snapshot_date:  string;
  }[] = [];

  const now = Date.now();

  for (const snap of confirmedSnaps) {
    const spotCurrent  = currentPrices[snap.ticker];
    if (!spotCurrent) continue;

    const atr14        = atrByTicker[snap.ticker] ?? 0;
    const thresholdPct = dynamicThresholdPct(atr14, spotCurrent);
    const thresholdUsd = spotCurrent * thresholdPct;
    const levels       = extractLevels(snap);
    const ageDays      = Math.floor((now - new Date(snap.created_at).getTime()) / 86400000);

    for (const { module, level_type, level } of levels) {
      const distance_usd = Math.abs(spotCurrent - level);
      if (distance_usd > thresholdUsd) continue;

      const distance_pct = (distance_usd / spotCurrent) * 100;

      alerts.push({
        ticker:         snap.ticker,
        spot_current:   Math.round(spotCurrent * 100) / 100,
        level:          Math.round(level * 100) / 100,
        level_type,
        module,
        distance_usd:   Math.round(distance_usd * 100) / 100,
        distance_pct:   Math.round(distance_pct * 100) / 100,
        threshold_pct:  Math.round(thresholdPct * 10000) / 100,
        atr14:          atr14 > 0 ? Math.round(atr14 * 100) / 100 : null,
        level_age_days: ageDays,
        regime:         snap.m7_regime ?? null,
        m7_verdict:     snap.m7_final_verdict ?? null,
        snapshot_date:  snap.created_at.split("T")[0],
      });
    }
  }

  alerts.sort((a, b) => a.distance_pct - b.distance_pct);

  return NextResponse.json({
    alerts,
    tickers_scanned:  tickers.length,
    analyzed_tickers: tickers,
    min_age_days:     minAgeDays,
    cutoff_date:      cutoff.split("T")[0],
    prices_fetched:   Object.keys(currentPrices).length,
    threshold_mode:   "dynamic_atr",
  });
}
