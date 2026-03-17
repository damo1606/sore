import { NextRequest, NextResponse } from "next/server";
import { computeSpyMetrics, computeRegime } from "@/lib/gex6";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

async function getCredentials(): Promise<{ crumb: string; cookie: string }> {
  const res1 = await fetch("https://fc.yahoo.com", { headers: HEADERS, redirect: "follow" });
  const setCookie = res1.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(",").map((c) => c.split(";")[0].trim()).join("; ");
  const res2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...HEADERS, Cookie: cookie },
  });
  if (!res2.ok) throw new Error(`Could not get crumb (${res2.status})`);
  const crumb = await res2.text();
  if (!crumb || crumb.includes("<")) throw new Error("Invalid crumb");
  return { crumb, cookie };
}

/** Fetch daily close history for a symbol (VIX, VIX3M, etc.) */
async function fetchHistory(
  symbol: string,
  cookie: string,
  crumb: string,
  range = "5d"
): Promise<{ current: number; history: number[] }> {
  const encoded = encodeURIComponent(symbol);
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=${range}&crumb=${crumb}`;
  const res = await fetch(url, { headers: { ...HEADERS, Cookie: cookie }, cache: "no-store" });
  if (!res.ok) throw new Error(`Could not fetch ${symbol} (${res.status})`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
  const valid = closes.filter((v): v is number => v != null);
  return { current: valid[valid.length - 1] ?? 0, history: valid };
}

/** Fetch SPY options chain (primary expiration) */
async function fetchSpyOptions(cookie: string, crumb: string) {
  const url = `https://query2.finance.yahoo.com/v7/finance/options/SPY?crumb=${crumb}`;
  const res = await fetch(url, { headers: { ...HEADERS, Cookie: cookie }, cache: "no-store" });
  if (!res.ok) throw new Error(`Could not fetch SPY options (${res.status})`);
  const json = await res.json();
  const result = json?.optionChain?.result?.[0];
  if (!result) throw new Error("No SPY options data");
  return result;
}

export async function GET(_request: NextRequest) {
  try {
    const { crumb, cookie } = await getCredentials();

    // Fetch VIX, VIX3M, and SPY options in parallel
    const [vixData, vix3mData, spyResult] = await Promise.all([
      fetchHistory("^VIX",  cookie, crumb, "5d"),
      fetchHistory("^VIX3M", cookie, crumb, "5d").catch(() => ({ current: 0, history: [] as number[] })),
      fetchSpyOptions(cookie, crumb),
    ]);

    const vix   = vixData.current;
    const vix3m = vix3mData.current > 0 ? vix3mData.current : vix * 1.05; // fallback: 5% premium
    const vixHistory = vixData.history;

    const spySpot: number = spyResult.quote?.regularMarketPrice ?? 0;
    const optData = spyResult.options?.[0];

    if (!optData) throw new Error("No SPY options chain");

    const today = new Date();
    const expTs: number = spyResult.expirationDates?.[0] ?? 0;
    const expDate = new Date(expTs * 1000);
    const T = Math.max(
      (expDate.getTime() - today.getTime()) / (365 * 24 * 60 * 60 * 1000),
      0.001
    );

    const calls = (optData.calls ?? []).map((c: any) => ({
      strike: c.strike ?? 0,
      impliedVolatility: c.impliedVolatility ?? 0,
      openInterest: c.openInterest ?? 0,
    }));
    const puts = (optData.puts ?? []).map((p: any) => ({
      strike: p.strike ?? 0,
      impliedVolatility: p.impliedVolatility ?? 0,
      openInterest: p.openInterest ?? 0,
    }));

    const { gexTotal: spyGexTotal, pcr: spyPcr } = computeSpyMetrics(calls, puts, spySpot, T);

    const result = computeRegime(vix, vix3m, vixHistory, spyGexTotal, spyPcr, spySpot);

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
