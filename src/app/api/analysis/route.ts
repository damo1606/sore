import { NextRequest, NextResponse } from "next/server";
import { computeAnalysis } from "@/lib/gex";

const YF = "https://query1.finance.yahoo.com";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Accept: "application/json",
};

async function fetchOptions(ticker: string, dateTs?: number) {
  const url = dateTs
    ? `${YF}/v7/finance/options/${ticker}?date=${dateTs}`
    : `${YF}/v7/finance/options/${ticker}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`);
  const json = await res.json();
  const result = json?.optionChain?.result?.[0];
  if (!result) throw new Error(`No options data for ${ticker}`);
  return result;
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker")?.toUpperCase();
  const expiration = request.nextUrl.searchParams.get("expiration") ?? undefined;

  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }

  try {
    const initial = await fetchOptions(ticker);

    const spot: number = initial.quote?.regularMarketPrice;
    if (!spot) {
      return NextResponse.json({ error: `No price data for ${ticker}` }, { status: 400 });
    }

    const availableExpirations: string[] = (initial.expirationDates as number[]).map(
      (ts) => new Date(ts * 1000).toISOString().split("T")[0]
    );

    let optData = initial.options?.[0];
    let selectedExpiration = availableExpirations[0];

    if (expiration && expiration !== selectedExpiration) {
      const ts = Math.floor(new Date(expiration + "T12:00:00Z").getTime() / 1000);
      const specific = await fetchOptions(ticker, ts);
      optData = specific.options?.[0];
      selectedExpiration = expiration;
    }

    if (!optData) {
      return NextResponse.json({ error: "No options chain available" }, { status: 400 });
    }

    const rawCalls = (optData.calls ?? []).map((c: any) => ({
      strike: c.strike ?? 0,
      impliedVolatility: c.impliedVolatility ?? 0,
      openInterest: c.openInterest ?? 0,
    }));

    const rawPuts = (optData.puts ?? []).map((p: any) => ({
      strike: p.strike ?? 0,
      impliedVolatility: p.impliedVolatility ?? 0,
      openInterest: p.openInterest ?? 0,
    }));

    const result = computeAnalysis(
      ticker,
      spot,
      selectedExpiration,
      availableExpirations,
      rawCalls,
      rawPuts
    );

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
