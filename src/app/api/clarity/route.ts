import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

function isFriday(dateStr: string): boolean {
  return new Date(dateStr + "T12:00:00Z").getDay() === 5;
}

function isMonthlyOpex(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00Z");
  if (d.getDay() !== 5) return false;
  // 3er viernes del mes: el día está entre el 15 y el 21
  return d.getDate() >= 15 && d.getDate() <= 21;
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker requerido" }, { status: 400 });

  const { data, error } = await supabaseServer()
    .from("sr_snapshots")
    .select("created_at, primary_exp_date, m7_confidence, m7_final_score, m7_regime, spot")
    .eq("ticker", ticker)
    .order("created_at", { ascending: true })
    .limit(90);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ points: [] });

  // Filtrar solo snapshots cuyo primary_exp_date sea viernes (weekly o mensual)
  const points = data
    .filter((row) => row.primary_exp_date && isFriday(row.primary_exp_date))
    .map((row) => ({
      date:           row.primary_exp_date,
      recorded_at:    row.created_at.split("T")[0],
      confidence:     row.m7_confidence ?? 0,
      score:          row.m7_final_score ?? 0,
      regime:         row.m7_regime ?? "neutral",
      spot:           row.spot,
      isMonthlyOpex:  isMonthlyOpex(row.primary_exp_date),
    }));

  // Deduplicar por fecha de vencimiento (quedarse con el más reciente)
  const deduped = Array.from(new Map(points.map((p) => [p.date, p])).values());

  return NextResponse.json({ ticker, points: deduped });
}
