import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { verifyToken, SESSION_COOKIE } from "@/lib/auth";

async function getUserId(req: NextRequest): Promise<string | null> {
  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    return payload.sub;
  } catch {
    return null;
  }
}

// GET /api/trades — lista los trades del usuario autenticado
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status"); // open | closed | all

  let query = supabaseServer()
    .from("trade_log")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trades: data ?? [] });
}

// POST /api/trades — registra un nuevo trade
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { ticker, direction, entry_price, stop_loss, take_profit, notes, snapshot_id } = body;

  if (!ticker || !direction || !entry_price) {
    return NextResponse.json({ error: "ticker, direction y entry_price son requeridos" }, { status: 400 });
  }

  const { data, error } = await supabaseServer()
    .from("trade_log")
    .insert({
      user_id:     userId,
      ticker:      ticker.toUpperCase(),
      direction,
      entry_price: Number(entry_price),
      stop_loss:   stop_loss   ? Number(stop_loss)   : null,
      take_profit: take_profit ? Number(take_profit) : null,
      notes:       notes ?? null,
      snapshot_id: snapshot_id ?? null,
      status:      "open",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trade: data });
}
