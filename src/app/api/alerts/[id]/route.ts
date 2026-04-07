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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabaseServer()
    .from("alerts")
    .delete()
    .eq("id", params.id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
