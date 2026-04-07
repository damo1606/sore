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

  const ticker      = req.nextUrl.searchParams.get("ticker");
  const snapshotId  = req.nextUrl.searchParams.get("snapshot_id");

  let query = supabaseServer().from("annotations").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (ticker)     query = query.eq("ticker", ticker.toUpperCase());
  if (snapshotId) query = query.eq("snapshot_id", snapshotId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ annotations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticker, body, snapshot_id } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "body requerido" }, { status: 400 });

  const { data, error } = await supabaseServer()
    .from("annotations")
    .insert({ user_id: userId, ticker: ticker?.toUpperCase() ?? null, body: body.trim(), snapshot_id: snapshot_id ?? null })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ annotation: data });
}
