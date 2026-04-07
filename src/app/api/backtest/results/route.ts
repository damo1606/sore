/**
 * GET /api/backtest/results?ticker=X
 *
 * Lee resultados persistidos en backtest_results para el ticker dado.
 * Devuelve: stats por módulo + detalle de niveles evaluados.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker requerido" }, { status: 400 });

  const db = supabaseServer();

  const { data, error } = await db
    .from("backtest_results")
    .select("*")
    .eq("ticker", ticker)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ ticker, results: [], stats: [], ran: false });

  // Recalcular stats desde los resultados persistidos
  const modules = ["M1", "M2", "M3", "M5", "GLOBAL"];
  const stats = modules.map((mod) => {
    const rows   = mod === "GLOBAL" ? data : data.filter((r) => r.module === mod);
    const tested = rows.filter((r) => r.was_tested);
    const resp   = tested.filter((r) => r.respected === true);
    const dirOk  = tested.filter((r) => r.direction_correct === true);
    const breached = tested.filter((r) => r.respected === false);
    const avgBreach = breached.length
      ? breached.reduce((s, r) => s + (r.breach_pct ?? 0), 0) / breached.length : 0;

    return {
      module:             mod,
      total_levels:       rows.length,
      tested:             tested.length,
      test_rate_pct:      rows.length > 0 ? Math.round((tested.length / rows.length) * 100) : 0,
      respected:          resp.length,
      accuracy_pct:       tested.length > 0 ? Math.round((resp.length / tested.length) * 100) : 0,
      direction_correct:  dirOk.length,
      direction_accuracy: tested.length > 0 ? Math.round((dirOk.length / tested.length) * 100) : 0,
      avg_breach_pct:     Math.round(avgBreach * 10000) / 100,
    };
  });

  return NextResponse.json({ ticker, results: data, stats, ran: true, total: data.length });
}
