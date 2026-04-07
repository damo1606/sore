/**
 * GET /api/score?ticker=X&module=M3&level=220&level_type=support
 *
 * Calcula P(nivel_respetado) usando el modelo estadístico de scoring.
 * Combina precisión histórica del backtest + señales live del último snapshot M7.
 *
 * Si no hay backtest previo para el ticker, usa prior neutro (50%) para las
 * features históricas y calcula igual con los datos de M7.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { scoreProbability, scoreProbabilityNoBacktest } from "@/lib/scoring";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ticker     = searchParams.get("ticker")?.toUpperCase();
  const module     = searchParams.get("module")?.toUpperCase();
  const levelStr   = searchParams.get("level");
  const level_type = searchParams.get("level_type") as "support" | "resistance" | null;

  if (!ticker)     return NextResponse.json({ error: "ticker requerido" },     { status: 400 });
  if (!module)     return NextResponse.json({ error: "module requerido" },     { status: 400 });
  if (!levelStr)   return NextResponse.json({ error: "level requerido" },      { status: 400 });
  if (!level_type) return NextResponse.json({ error: "level_type requerido" }, { status: 400 });

  const level = parseFloat(levelStr);
  if (isNaN(level)) return NextResponse.json({ error: "level debe ser número" }, { status: 400 });

  const db = supabaseServer();

  // ── 1. Stats históricas del backtest (accuracy por módulo/ticker) ───────────
  const { data: btRows } = await db
    .from("backtest_results")
    .select("was_tested, respected, direction_correct")
    .eq("ticker", ticker)
    .eq("module", module);

  let accuracy_pct       = 50;
  let direction_accuracy = 50;
  let backtest_ran       = false;

  if (btRows && btRows.length > 0) {
    backtest_ran = true;
    const tested    = btRows.filter((r) => r.was_tested);
    const respected = tested.filter((r) => r.respected === true);
    const dirOk     = tested.filter((r) => r.direction_correct === true);
    if (tested.length > 0) {
      accuracy_pct       = Math.round((respected.length / tested.length) * 100);
      direction_accuracy = Math.round((dirOk.length     / tested.length) * 100);
    }
  }

  // ── 2. Último snapshot del ticker ───────────────────────────────────────────
  const { data: snap } = await db
    .from("sr_snapshots")
    .select("spot, m7_confidence, m7_final_score, m7_regime, m7_final_verdict")
    .eq("ticker", ticker)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!snap) return NextResponse.json({ error: "Sin snapshots para este ticker — analiza primero en M7" }, { status: 404 });

  const spot         = snap.spot ?? 0;
  const m7_confidence  = snap.m7_confidence  ?? 50;
  const m7_final_score = snap.m7_final_score ?? 0;
  const regime         = snap.m7_regime      ?? "NEUTRAL";

  // ── 3. Distancia spot → nivel ────────────────────────────────────────────────
  const distance_pct = spot > 0 ? (Math.abs(spot - level) / spot) * 100 : 0;

  // ── 4. Calcular score ────────────────────────────────────────────────────────
  const result = backtest_ran
    ? scoreProbability({ accuracy_pct, direction_accuracy, m7_confidence, m7_final_score, regime, level_type, distance_pct })
    : scoreProbabilityNoBacktest(m7_confidence, m7_final_score, regime, level_type, distance_pct);

  return NextResponse.json({
    ticker,
    module,
    level,
    level_type,
    spot,
    distance_pct:       Math.round(distance_pct * 100) / 100,
    probability:        result.probability,
    confidence:         result.confidence,
    breakdown:          result.breakdown,
    backtest_ran,
    backtest_accuracy:  backtest_ran ? accuracy_pct : null,
    direction_accuracy: backtest_ran ? direction_accuracy : null,
    regime,
    m7_verdict:         snap.m7_final_verdict,
  });
}
