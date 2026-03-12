import { NextRequest, NextResponse } from "next/server";
import { computeAnalysis3, type ExpData } from "@/lib/gex3";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

async function getCredentials(): Promise<{ crumb: string; cookie: string }> {
  const res1 = await fetch("https://fc.yahoo.com", {
    headers: HEADERS,
    redirect: "follow",
  });
  const setCookie = res1.headers.get("set-cookie") ?? "";
  const cookie = setCookie
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .join("; ");

  const res2 = await fetch(
    "https://query2.finance.yahoo.com/v1/test/getcrumb",
    { headers: { ...HEADERS, Cookie: cookie } }
  );
  if (!res2.ok) throw new Error(`Could not get crumb (${res2.status})`);
  const crumb = await res2.text();
  if (!crumb || crumb.includes("<")) throw new Error("Invalid crumb");
  return { crumb, cookie };
}

async function fetchOptions(
  ticker: string,
  cookie: string,
  crumb: string,
  dateTs?: number
) {
  const params = new URLSearchParams({ crumb });
  if (dateTs) params.set("date", String(dateTs));
  const url = `https://query2.finance.yahoo.com/v7/finance/options/${ticker}?${params}`;
  const res = await fetch(url, {
    headers: { ...HEADERS, Cookie: cookie },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`);
  const json = await res.json();
  const result = json?.optionChain?.result?.[0];
  if (!result) throw new Error(`No options data for ${ticker}`);
  return result;
}

function parseChain(optData: any): { calls: any[]; puts: any[] } {
  const calls = (optData?.calls ?? []).map((c: any) => ({
    strike: c.strike ?? 0,
    impliedVolatility: c.impliedVolatility ?? 0,
    openInterest: c.openInterest ?? 0,
  }));
  const puts = (optData?.puts ?? []).map((p: any) => ({
    strike: p.strike ?? 0,
    impliedVolatility: p.impliedVolatility ?? 0,
    openInterest: p.openInterest ?? 0,
  }));
  return { calls, puts };
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }

  try {
    const { crumb, cookie } = await getCredentials();
    const initial = await fetchOptions(ticker, cookie, crumb);

    const spot: number = initial.quote?.regularMarketPrice;
    if (!spot) {
      return NextResponse.json({ error: `No price data for ${ticker}` }, { status: 400 });
    }

    const allExpTs: number[] = initial.expirationDates ?? [];
    const allExpDates = allExpTs.map((ts) => ({
      ts,
      date: new Date(ts * 1000).toISOString().split("T")[0],
    }));

    // Use up to 5 nearest expirations for aggregation
    const targetExps = allExpDates.slice(0, 5);

    // First expiration data is already in initial.options[0]
    const firstOptData = initial.options?.[0];
    if (!firstOptData) {
      return NextResponse.json({ error: "No options chain available" }, { status: 400 });
    }

    const expDataList: ExpData[] = [];

    // Add first expiration from the initial fetch (no extra call needed)
    const firstChain = parseChain(firstOptData);
    expDataList.push({
      expiration: targetExps[0]?.date ?? allExpDates[0]?.date ?? "",
      ...firstChain,
    });

    // Fetch remaining expirations in parallel
    const remaining = targetExps.slice(1);
    const results = await Promise.allSettled(
      remaining.map(({ ts, date }) =>
        fetchOptions(ticker, cookie, crumb, ts).then((result) => ({
          date,
          optData: result.options?.[0],
        }))
      )
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value.optData) {
        const chain = parseChain(r.value.optData);
        expDataList.push({ expiration: r.value.date, ...chain });
      }
    }

    const analysis = computeAnalysis3(ticker, spot, expDataList);
    return NextResponse.json(analysis);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
