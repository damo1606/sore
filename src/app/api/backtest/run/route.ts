/**
 * POST /api/backtest/run?ticker=X
 *
 * Motor de backtesting completo:
 * 1. Carga snapshots del ticker desde sr_snapshots
 * 2. Obtiene precios históricos (con caché de 4h en Supabase)
 * 3. Detecta splits y ajusta niveles históricos
 * 4. Evalúa cada nivel con ATR dinámico y ventana por módulo
 * 5. Persiste resultados en backtest_results (upsert por snapshot_id + module + level)
 * 6. Devuelve resumen estadístico completo
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer }            from "@/lib/supabase";
import { getPrices, adjustLevelForSplits, findPriceIndex } from "@/lib/priceCache";
import { calculateATR14, dynamicBreachThreshold, testZoneThreshold, evaluateLevel, MODULE_WINDOWS } from "@/lib/indicators";

// Deduplicar snapshots: solo el primero del día por ticker
function deduplicateByDay(snapshots: any[]): any[] {
  const seen = new Set<string>();
  return snapshots.filter((s) => {
    const day = s.created_at.split("T")[0];
    if (seen.has(day)) return false;
    seen.add(day);
    return true;
  });
}

// Estructura de niveles por módulo para un snapshot
function extractLevels(snap: any): { module: string; type: "support" | "resistance"; rawLevel: number }[] {
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
    .map(([module, type, rawLevel]) => ({ module, type, rawLevel: rawLevel! }));
}

export async function POST(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker requerido" }, { status: 400 });

  try {
    const db = supabaseServer();

    // ── 1. Cargar snapshots ────────────────────────────────────────────────────
    const { data: rawSnapshots, error: snapErr } = await db
      .from("sr_snapshots")
      .select("id, created_at, spot, m7_final_verdict, m7_regime, m1_support, m1_resistance, m2_support, m2_resistance, m3_support, m3_resistance, m5_support_strike, m5_resistance_strike")
      .eq("ticker", ticker)
      .order("created_at", { ascending: true })
      .limit(60);

    if (snapErr) throw new Error(snapErr.message);
    if (!rawSnapshots?.length) return NextResponse.json({ error: "Sin snapshots para este ticker — analiza primero en M7" }, { status: 404 });

    const snapshots = deduplicateByDay(rawSnapshots);

    // ── 2. Obtener precios (caché → Yahoo Finance) ────────────────────────────
    const { prices, splits } = await getPrices(ticker);
    if (!prices.length) return NextResponse.json({ error: "Sin datos de precio para el ticker" }, { status: 404 });

    // ── 3. Procesar cada snapshot ─────────────────────────────────────────────
    const toInsert: any[] = [];

    for (const snap of snapshots) {
      const snapDate = snap.created_at.split("T")[0];
      const snapIdx  = findPriceIndex(prices, snapDate);
      if (snapIdx === -1) continue; // snapshot más antiguo que el histórico disponible

      const atr14 = calculateATR14(prices, snapDate);
      const spot  = snap.spot ?? prices[snapIdx]?.close ?? 0;

      const levels = extractLevels(snap);

      for (const { module, type, rawLevel } of levels) {
        // Ajustar el nivel por splits ocurridos después del snapshot
        const adjustedLevel = adjustLevelForSplits(rawLevel, snapDate, splits);

        // Ventana de días según el módulo
        const windowDays = MODULE_WINDOWS[module] ?? 5;
        const nextDays   = prices.slice(snapIdx + 1, snapIdx + 1 + windowDays);

        if (!nextDays.length) continue; // snapshot muy reciente, sin datos futuros aún

        // Evaluar nivel
        const eval_ = evaluateLevel(adjustedLevel, type, nextDays, atr14, spot, snap.m7_final_verdict);

        toInsert.push({
          snapshot_id:      snap.id,
          ticker,
          module,
          level_type:       type,
          level_price:      adjustedLevel,
          spot_at_snapshot: spot,
          regime:           snap.m7_regime,
          m7_verdict:       snap.m7_final_verdict,
          eval_window_days: windowDays,
          was_tested:       eval_.was_tested,
          respected:        eval_.respected,
          breach_pct:       eval_.breach_pct,
          first_test_date:  eval_.first_test_date,
          atr14,
          dynamic_threshold: dynamicBreachThreshold(atr14, spot),
          direction_correct: eval_.direction_correct,
        });
      }
    }

    // ── 4. Persistir en backtest_results (upsert por snapshot+module+type+level) ─
    if (toInsert.length > 0) {
      // Borrar resultados previos del ticker y reinsertar (recalculo completo)
      await db.from("backtest_results").delete().eq("ticker", ticker);
      await db.from("backtest_results").insert(toInsert);
    }

    // ── 5. Calcular estadísticas ──────────────────────────────────────────────
    const tested  = toInsert.filter((r) => r.was_tested);
    const stats   = buildStats(toInsert, tested);

    return NextResponse.json({
      ticker,
      snapshots_processed:   snapshots.length,
      levels_evaluated:      toInsert.length,
      levels_tested:         tested.length,
      splits_detected:       splits.length,
      stats,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error interno" }, { status: 500 });
  }
}

// ── Estadísticas por módulo + globales ────────────────────────────────────────

function buildStats(all: any[], tested: any[]) {
  const modules = ["M1", "M2", "M3", "M5", "GLOBAL"];

  return modules.map((mod) => {
    const rows   = mod === "GLOBAL" ? all   : all.filter((r) => r.module === mod);
    const tRows  = mod === "GLOBAL" ? tested : tested.filter((r) => r.module === mod);

    const respected        = tRows.filter((r) => r.respected === true);
    const notRespected     = tRows.filter((r) => r.respected === false);
    const dirCorrect       = tRows.filter((r) => r.direction_correct === true);
    const avgBreach        = notRespected.length
      ? notRespected.reduce((s, r) => s + (r.breach_pct ?? 0), 0) / notRespected.length
      : 0;
    const avgThreshold     = rows.length
      ? rows.reduce((s, r) => s + (r.dynamic_threshold ?? 0), 0) / rows.length
      : 0;

    return {
      module:              mod,
      total_levels:        rows.length,
      tested:              tRows.length,
      test_rate_pct:       rows.length > 0 ? Math.round((tRows.length / rows.length) * 100) : 0,
      respected:           respected.length,
      accuracy_pct:        tRows.length > 0 ? Math.round((respected.length / tRows.length) * 100) : 0,
      direction_correct:   dirCorrect.length,
      direction_accuracy:  tRows.length > 0 ? Math.round((dirCorrect.length / tRows.length) * 100) : 0,
      avg_breach_pct:      Math.round(avgBreach * 10000) / 100,
      avg_threshold_pct:   Math.round(avgThreshold * 10000) / 100,
    };
  });
}
