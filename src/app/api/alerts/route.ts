import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { verifyToken, SESSION_COOKIE } from "@/lib/auth";

async function getUserId(req: NextRequest): Promise<string | null> {
  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    return payload.sub;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ticker = req.nextUrl.searchParams.get("ticker");
  let query = supabaseServer().from("alerts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (ticker) query = query.eq("ticker", ticker.toUpperCase());

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alerts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticker, alert_type, level } = await req.json();
  if (!ticker || !alert_type || level == null) {
    return NextResponse.json({ error: "ticker, alert_type y level son requeridos" }, { status: 400 });
  }

  const { data, error } = await supabaseServer()
    .from("alerts")
    .insert({ user_id: userId, ticker: ticker.toUpperCase(), alert_type, level: Number(level) })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: data });
}
