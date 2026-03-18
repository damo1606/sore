import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) return NextResponse.json({ results: [] });

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&enableFuzzyQuery=true&enableNavLinks=false`;
    const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) return NextResponse.json({ results: [] });

    const json = await res.json();
    const quotes = json?.quotes ?? [];

    const results: SearchResult[] = quotes
      .filter((q: any) => ["EQUITY", "ETF", "INDEX"].includes(q.quoteType))
      .map((q: any) => ({
        symbol:   q.symbol ?? "",
        name:     q.shortname ?? q.longname ?? q.symbol ?? "",
        exchange: q.exchDisp ?? q.exchange ?? "",
        type:     q.quoteType ?? "",
      }))
      .filter((r: SearchResult) => r.symbol);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
