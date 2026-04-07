import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabaseServer()
      .from("rotation_snapshots")
      .select("id, created_at, signal, growth_avg, defensive_avg, alt_avg, etfs")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw new Error(error.message);
    return NextResponse.json({ snapshots: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
