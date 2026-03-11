import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";
import { computeAnalysis } from "@/lib/gex";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker")?.toUpperCase();
  const expiration = request.nextUrl.searchParams.get("expiration") ?? undefined;

  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }

  try {
    yahooFinance.setGlobalConfig({ validation: { logErrors: false } });

    const quote = await yahooFinance.quote(ticker);
    const spot = quote.regularMarketPrice;
    if (!spot) {
      return NextResponse.json({ error: `No price data for ${ticker}` }, { status: 400 });
    }

    const optResult = await yahooFinance.options(
      ticker,
      expiration ? { date: new Date(expiration + "T12:00:00Z") } : undefined
    );

    const availableExpirations = optResult.expirationDates.map((d: Date) =>
      new Date(d).toISOString().split("T")[0]
    );

    const selectedExpiration = expiration ?? availableExpirations[0];
    const optData = optResult.options[0];

    if (!optData) {
      return NextResponse.json({ error: "No options data available" }, { status: 400 });
    }

    const rawCalls = optData.calls.map((c: any) => ({
      strike: c.strike ?? 0,
      impliedVolatility: c.impliedVolatility ?? 0,
      openInterest: c.openInterest ?? 0,
    }));

    const rawPuts = optData.puts.map((p: any) => ({
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
