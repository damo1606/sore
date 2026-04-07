/**
 * GET /api/score/levels?ticker=X
 *
 * Devuelve todos los niveles activos del último snapshot del ticker
 * con su P(respetado) calculada por el modelo estadístico.
 * Una sola query — no N+1.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { scoreProbability, scoreProbabilityNoBacktest } from "@/lib/scoring";

interface ScoredLevel {
  module:            string;
  level_type:        "support" | "resistance";
  level:             number;
  spot:              number;
  distance_pct:      number;
  probability:       number;
  confidence:        "ALTA" | "MEDIA" | "BAJA";
  breakdown:         Record<string, number>;
  backtest_accuracy: number | null;
  direction_accuracy: number | null;
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker requerido" }, { status: 400 });

  const db = supabaseServer();

  // ── 1. Último snapshot ───────────────────────────────────────────────────────
  const { data: snap } = await db
    .from("sr_snapshots")
    .select("spot, m7_confidence, m7_final_score, m7_regime, m7_final_verdict, m1_support, m1_resistance, m2_support, m2_resistance, m3_support, m3_resistance, m5_support_strike, m5_resistance_strike")
    .eq("ticker", ticker)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!snap) return NextResponse.json({ error: "Sin snapshots para este ticker" }, { status: 404 });

  const spot           = snap.spot ?? 0;
  const m7_confidence  = snap.m7_confidence  ?? 50;
  const m7_final_score = snap.m7_final_score ?? 0;
  const regime         = snap.m7_regime      ?? "NEUTRAL";

  // ── 2. Stats del backtest por módulo ─────────────────────────────────────────
  const { data: btRows } = await db
    .from("backtest_results")
    .select("module, was_tested, respected, direction_correct")
    .eq("ticker", ticker);

  // Calcular accuracy por módulo
  const moduleStats: Record<string, { accuracy_pct: number; direction_accuracy: number; has_data: boolean }> = {};
  const modules = ["M1", "M2", "M3", "M5"];

  for (const mod of modules) {
    const rows    = (btRows ?? []).filter((r) => r.module === mod);
    const tested  = rows.filter((r) => r.was_tested);
    const resp    = tested.filter((r) => r.respected === true);
    const dirOk   = tested.filter((r) => r.direction_correct === true);

    moduleStats[mod] = {
      has_data:         tested.length > 0,
      accuracy_pct:     tested.length > 0 ? Math.round((resp.length   / tested.length) * 100) : 50,
      direction_accuracy: tested.length > 0 ? Math.round((dirOk.length / tested.length) * 100) : 50,
    };
  }

  // ── 3. Extraer niveles activos del snapshot ───────────────────────────────────
  const levelPairs: [string, "support" | "resistance", number | null][] = [
    ["M1", "support",    snap.m1_support],
    ["M1", "resistance", snap.m1_resistance],
    ["M2", "support",    snap.m2_support],
    ["M2", "resistance", snap.m2_resistance],
    ["M3", "support",    snap.m3_support],
    ["M3", "resistance", snap.m3_resistance],
    ["M5", "support",    snap.m5_support_strike],
    ["M5", "resistance", snap.m5_resistance_strike],
  ];

  // ── 4. Calcular score para cada nivel ─────────────────────────────────────────
  const scored: ScoredLevel[] = [];

  for (const [mod, level_type, levelPrice] of levelPairs) {
    if (!levelPrice || levelPrice <= 0) continue;

    const distance_pct = spot > 0 ? (Math.abs(spot - levelPrice) / spot) * 100 : 0;
    const ms = moduleStats[mod];

    const result = ms.has_data
      ? scoreProbability({
          accuracy_pct:       ms.accuracy_pct,
          direction_accuracy: ms.direction_accuracy,
          m7_confidence,
          m7_final_score,
          regime,
          level_type,
          distance_pct,
        })
      : scoreProbabilityNoBacktest(m7_confidence, m7_final_score, regime, level_type, distance_pct);

    scored.push({
      module:             mod,
      level_type,
      level:              levelPrice,
      spot,
      distance_pct:       Math.round(distance_pct * 100) / 100,
      probability:        result.probability,
      confidence:         result.confidence,
      breakdown:          result.breakdown,
      backtest_accuracy:  ms.has_data ? ms.accuracy_pct  : null,
      direction_accuracy: ms.has_data ? ms.direction_accuracy : null,
    });
  }

  // Ordenar por distancia al spot (más cercano primero)
  scored.sort((a, b) => a.distance_pct - b.distance_pct);

  return NextResponse.json({
    ticker,
    spot,
    regime,
    m7_verdict:    snap.m7_final_verdict,
    m7_confidence,
    backtest_ran:  (btRows?.length ?? 0) > 0,
    levels:        scored,
  });
}
