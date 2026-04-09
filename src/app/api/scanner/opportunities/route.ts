/**
 * GET /api/scanner/opportunities?tickers=X,Y&min_probability=50
 *
 * Scanner inteligente de oportunidades:
 * - Detecta precio cerca de niveles S/R (mismo criterio ATR que /proximity)
 * - Filtra por régimen favorable y VIX razonable
 * - Calcula P(respetado) con el modelo de scoring
 * - Añade estructura del trade: dirección, entry, stop, target, RR
 * - Ordena por probabilidad descendente
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer }            from "@/lib/supabase";
import { scoreProbability, scoreProbabilityNoBacktest } from "@/lib/scoring";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

const MIN_PCT      = 0.015;
const ATR_MULT     = 0.5;
const FALLBACK_PCT = 0.02;

// Regímenes donde las señales son confiables
const FAVORABLE_REGIMES = ["COMPRESIÓN", "TRANSICIÓN", "COMPRESION"];
const UNFAVORABLE_REGIMES = ["PÁNICO AGUDO", "CRISIS SISTÉMICA", "PANICO AGUDO", "CRISIS SISTEMICA"];

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

function buildTradeStructure(
  spot:        number,
  level:       number,
  levelType:   "support" | "resistance",
  thresholdPct: number,
  atr14:       number | null,
): { direction: "LONG" | "SHORT"; entry: number; stop: number; target: number; rr_ratio: number } {
  const zone  = spot * thresholdPct;
  const atrZ  = atr14 ? atr14 * 0.5 : zone;
  const stopD = Math.max(zone * 1.2, atrZ);

  if (levelType === "support") {
    const entry  = spot;
    const stop   = Math.max(level - stopD, level * 0.95);
    const risk   = Math.abs(entry - stop);
    const target = entry + risk * 2;
    return { direction: "LONG", entry: Math.round(entry * 100) / 100, stop: Math.round(stop * 100) / 100, target: Math.round(target * 100) / 100, rr_ratio: 2.0 };
  } else {
    const entry  = spot;
    const stop   = Math.min(level + stopD, level * 1.05);
    const risk   = Math.abs(stop - entry);
    const target = entry - risk * 2;
    return { direction: "SHORT", entry: Math.round(entry * 100) / 100, stop: Math.round(stop * 100) / 100, target: Math.round(target * 100) / 100, rr_ratio: 2.0 };
  }
}

export async function GET(req: NextRequest) {
  const tickersParam   = req.nextUrl.searchParams.get("tickers");
  const minProbability = parseFloat(req.nextUrl.searchParams.get("min_probability") ?? "45");
  const filterTickers  = tickersParam ? tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean) : null;

  const db = supabaseServer();

  // ── 1. Últimos snapshots por ticker (con datos M6) ───────────────────────────
  let query = db
    .from("sr_snapshots")
    .select(`ticker, created_at, spot,
      m1_support, m1_resistance, m2_support, m2_resistance,
      m3_support, m3_resistance, m5_support_strike, m5_resistance_strike,
      m7_final_score, m7_final_verdict, m7_confidence, m7_regime,
      m6_vix, m6_fear_score, m6_fear_label, m6_regime_score, macro_source`)
    .order("created_at", { ascending: false });

  if (filterTickers?.length) query = query.in("ticker", filterTickers);

  const { data: snapshots, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!snapshots?.length) return NextResponse.json({ opportunities: [], tickers_scanned: 0 });

  // Último snapshot por ticker
  const byTicker = new Map<string, typeof snapshots[0]>();
  for (const snap of snapshots) {
    if (!byTicker.has(snap.ticker)) byTicker.set(snap.ticker, snap);
  }
  const latestSnaps = Array.from(byTicker.values());
  const tickers     = latestSnaps.map((s) => s.ticker);

  // ── 2. ATR por ticker ────────────────────────────────────────────────────────
  const { data: btRows } = await db
    .from("backtest_results")
    .select("ticker, atr14, accuracy_pct, direction_accuracy")
    .in("ticker", tickers)
    .gt("atr14", 0);

  const atrByTicker:      Record<string, number> = {};
  const accuracyByTicker: Record<string, { accuracy_pct: number; direction_accuracy: number }> = {};

  for (const row of (btRows ?? [])) {
    if (!atrByTicker[row.ticker]) {
      atrByTicker[row.ticker]      = row.atr14;
      accuracyByTicker[row.ticker] = { accuracy_pct: row.accuracy_pct ?? 50, direction_accuracy: row.direction_accuracy ?? 50 };
    }
  }

  // ── 3. Precios actuales ──────────────────────────────────────────────────────
  const currentPrices = await fetchBatchPrices(tickers);

  // ── 4. Calcular oportunidades ────────────────────────────────────────────────
  const now = Date.now();
  const opportunities: any[] = [];

  for (const snap of latestSnaps) {
    const spotCurrent = currentPrices[snap.ticker];
    if (!spotCurrent) continue;

    // Filtrar regímenes de pánico/crisis
    const regime = snap.m7_regime ?? "NEUTRAL";
    if (UNFAVORABLE_REGIMES.some((r) => regime.includes(r.split(" ")[0]))) continue;

    // Filtrar VIX muy alto (señales poco confiables)
    const vix = snap.m6_vix ?? 0;
    if (vix > 35) continue;

    const atr14        = atrByTicker[snap.ticker] ?? 0;
    const thresholdPct = dynamicThresholdPct(atr14, spotCurrent);
    const thresholdUsd = spotCurrent * thresholdPct;
    const levels       = extractLevels(snap);
    const ageDays      = Math.floor((now - new Date(snap.created_at).getTime()) / 86400000);
    const bt           = accuracyByTicker[snap.ticker];

    for (const { module, level_type, level } of levels) {
      const distance_usd = Math.abs(spotCurrent - level);
      if (distance_usd > thresholdUsd) continue;

      const distance_pct = (distance_usd / spotCurrent) * 100;

      // Calcular probabilidad
      const scoreResult = bt
        ? scoreProbability({
            accuracy_pct:       bt.accuracy_pct,
            direction_accuracy: bt.direction_accuracy,
            m7_confidence:      snap.m7_confidence ?? 50,
            m7_final_score:     snap.m7_final_score ?? 0,
            regime,
            level_type,
            distance_pct,
          })
        : scoreProbabilityNoBacktest(
            snap.m7_confidence ?? 50,
            snap.m7_final_score ?? 0,
            regime,
            level_type,
            distance_pct,
          );

      if (scoreResult.probability < minProbability) continue;

      const trade = buildTradeStructure(spotCurrent, level, level_type, thresholdPct, atr14 > 0 ? atr14 : null);

      opportunities.push({
        ticker:        snap.ticker,
        spot:          Math.round(spotCurrent * 100) / 100,
        level:         Math.round(level * 100) / 100,
        level_type,
        module,
        distance_pct:  Math.round(distance_pct * 100) / 100,
        threshold_pct: Math.round(thresholdPct * 10000) / 100,
        probability:   scoreResult.probability,
        confidence:    scoreResult.confidence,
        breakdown:     scoreResult.breakdown,
        direction:     trade.direction,
        entry:         trade.entry,
        stop:          trade.stop,
        target:        trade.target,
        rr_ratio:      trade.rr_ratio,
        regime,
        vix:           vix > 0 ? Math.round(vix * 100) / 100 : null,
        fear_score:    snap.m6_fear_score ?? null,
        fear_label:    snap.m6_fear_label ?? null,
        regime_score:  snap.m6_regime_score ?? null,
        macro_source:  snap.macro_source ?? "YAHOO",
        level_age_days: ageDays,
        snapshot_date:  snap.created_at.split("T")[0],
        backtest_used:  !!bt,
      });
    }
  }

  // Ordenar por probabilidad descendente
  opportunities.sort((a, b) => b.probability - a.probability);

  return NextResponse.json({
    opportunities,
    total:           opportunities.length,
    tickers_scanned: tickers.length,
    min_probability: minProbability,
    generated_at:    new Date().toISOString(),
  });
}
