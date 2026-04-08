/**
 * GET /api/watchlist/status?tickers=AAPL,MSFT,...
 *
 * Devuelve cuáles de los tickers dados tienen al menos un snapshot en sr_snapshots.
 * Usado por el batch analyzer para saber cuáles faltan.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("tickers");
  if (!param) return NextResponse.json({ analyzed: [] });

  const tickers = param.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (!tickers.length) return NextResponse.json({ analyzed: [] });

  const db = supabaseServer();

  const { data } = await db
    .from("sr_snapshots")
    .select("ticker")
    .in("ticker", tickers);

  const analyzed = [...new Set((data ?? []).map((r) => r.ticker))];

  return NextResponse.json({ analyzed, total: tickers.length });
}
