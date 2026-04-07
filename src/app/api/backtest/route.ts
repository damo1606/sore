import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

async function fetchDailyPrices(ticker: string): Promise<{ date: string; low: number; high: number; close: number }[]> {
  const res1 = await fetch("https://fc.yahoo.com", { headers: HEADERS, redirect: "follow" });
  const setCookie = res1.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(",").map((c) => c.split(";")[0].trim()).join("; ");
  const res2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { ...HEADERS, Cookie: cookie } });
  const crumb = await res2.text();

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo&crumb=${crumb}`;
  const res = await fetch(url, { headers: { ...HEADERS, Cookie: cookie }, cache: "no-store" });
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No price data for ${ticker}`);

  const timestamps: number[] = result.timestamp ?? [];
  const quotes = result.indicators?.quote?.[0] ?? {};
  const lows:   (number | null)[] = quotes.low   ?? [];
  const highs:  (number | null)[] = quotes.high  ?? [];
  const closes: (number | null)[] = quotes.close ?? [];

  return timestamps.map((ts, i) => ({
    date:  new Date(ts * 1000).toISOString().split("T")[0],
    low:   lows[i]   ?? 0,
    high:  highs[i]  ?? 0,
    close: closes[i] ?? 0,
  })).filter((d) => d.low > 0);
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker requerido" }, { status: 400 });

  try {
    // Obtener snapshots del ticker (últimos 30)
    const { data: snapshots, error } = await supabaseServer()
      .from("sr_snapshots")
      .select("id, created_at, spot, m1_support, m1_resistance, m2_support, m2_resistance, m3_support, m3_resistance, m5_support_strike, m5_resistance_strike, m7_final_score, m7_regime")
      .eq("ticker", ticker)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);
    if (!snapshots?.length) return NextResponse.json({ error: "Sin snapshots para este ticker" }, { status: 404 });

    // Obtener precios diarios reales
    const prices = await fetchDailyPrices(ticker);
    const priceMap = new Map(prices.map((p) => [p.date, p]));

    // Evaluar cada snapshot
    const PROXIMITY = 0.01; // ±1% para considerar que tocó el nivel
    const BREACH    = 0.015; // >1.5% de brecha = no respetado

    const results = snapshots.map((snap) => {
      const snapDate = snap.created_at.split("T")[0];
      const snapIdx  = prices.findIndex((p) => p.date >= snapDate);
      const nextDays = prices.slice(snapIdx + 1, snapIdx + 6); // próximos 5 días

      function evalLevel(level: number | null, type: "support" | "resistance") {
        if (!level) return null;
        let respected = true;
        for (const day of nextDays) {
          if (type === "support"    && day.low  < level * (1 - BREACH)) { respected = false; break; }
          if (type === "resistance" && day.high > level * (1 + BREACH)) { respected = false; break; }
        }
        const touched = nextDays.some((day) =>
          type === "support"
            ? Math.abs(day.low - level) / level <= PROXIMITY
            : Math.abs(day.high - level) / level <= PROXIMITY
        );
        return { level, type, respected, touched, daysChecked: nextDays.length };
      }

      return {
        snapshot_id: snap.id,
        date:        snapDate,
        spot:        snap.spot,
        regime:      snap.m7_regime,
        score:       snap.m7_final_score,
        levels: [
          evalLevel(snap.m1_support,        "support"),
          evalLevel(snap.m1_resistance,     "resistance"),
          evalLevel(snap.m2_support,        "support"),
          evalLevel(snap.m2_resistance,     "resistance"),
          evalLevel(snap.m3_support,        "support"),
          evalLevel(snap.m3_resistance,     "resistance"),
          evalLevel(snap.m5_support_strike, "support"),
          evalLevel(snap.m5_resistance_strike, "resistance"),
        ].filter(Boolean),
      };
    });

    // Estadísticas globales por módulo
    const modules = [
      { name: "M1", keys: ["m1_support", "m1_resistance"] },
      { name: "M2", keys: ["m2_support", "m2_resistance"] },
      { name: "M3", keys: ["m3_support", "m3_resistance"] },
      { name: "M5", keys: ["m5_support_strike", "m5_resistance_strike"] },
    ];

    const moduleStats = modules.map(({ name }) => {
      const allLevels = results.flatMap((r) => r.levels ?? []).filter(Boolean);
      const total     = allLevels.length;
      const respected = allLevels.filter((l) => l?.respected).length;
      return { module: name, total, respected, accuracy: total > 0 ? Math.round((respected / total) * 100) : 0 };
    });

    return NextResponse.json({ ticker, snapshots: results, moduleStats });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}
