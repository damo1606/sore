import { gammaBS, vannaBS } from "./blackscholes";
import type { AnalysisResult, GexPoint, VannaPoint } from "@/types";

const RISK_FREE_RATE = 0.05;
const CONTRACT_SIZE = 100;
const MIN_OI = 10;

interface RawOption {
  strike: number;
  impliedVolatility: number;
  openInterest: number;
}

interface ProcessedOption {
  strike: number;
  iv: number;
  oi: number;
  type: "call" | "put";
  gex: number;
  vanna: number;
}

export function computeAnalysis(
  ticker: string,
  spot: number,
  expiration: string,
  availableExpirations: string[],
  rawCalls: RawOption[],
  rawPuts: RawOption[]
): AnalysisResult {
  const today = new Date();
  const expDate = new Date(expiration + "T00:00:00");
  const T = Math.max(
    (expDate.getTime() - today.getTime()) / (365 * 24 * 60 * 60 * 1000),
    0.001
  );

  const options: ProcessedOption[] = [];

  for (const c of rawCalls) {
    if (!c.impliedVolatility || !c.openInterest || c.openInterest < MIN_OI) continue;
    const g = gammaBS(spot, c.strike, T, RISK_FREE_RATE, c.impliedVolatility);
    const v = vannaBS(spot, c.strike, T, RISK_FREE_RATE, c.impliedVolatility);
    options.push({
      strike: c.strike,
      iv: c.impliedVolatility,
      oi: c.openInterest,
      type: "call",
      gex: g * c.openInterest * CONTRACT_SIZE * spot * spot,
      vanna: v * c.openInterest * CONTRACT_SIZE,
    });
  }

  for (const p of rawPuts) {
    if (!p.impliedVolatility || !p.openInterest || p.openInterest < MIN_OI) continue;
    const g = gammaBS(spot, p.strike, T, RISK_FREE_RATE, p.impliedVolatility);
    const v = vannaBS(spot, p.strike, T, RISK_FREE_RATE, p.impliedVolatility);
    options.push({
      strike: p.strike,
      iv: p.impliedVolatility,
      oi: p.openInterest,
      type: "put",
      gex: -(g * p.openInterest * CONTRACT_SIZE * spot * spot),
      vanna: -(v * p.openInterest * CONTRACT_SIZE),
    });
  }

  if (options.length === 0) {
    throw new Error("No valid options data after filtering");
  }

  // Aggregate by strike
  const gexMap = new Map<number, number>();
  const vannaMap = new Map<number, number>();

  for (const opt of options) {
    gexMap.set(opt.strike, (gexMap.get(opt.strike) ?? 0) + opt.gex);
    vannaMap.set(opt.strike, (vannaMap.get(opt.strike) ?? 0) + opt.vanna);
  }

  const gexProfile: GexPoint[] = Array.from(gexMap.entries())
    .map(([strike, gex]) => ({ strike, gex }))
    .sort((a, b) => a.strike - b.strike);

  const vannaProfile: VannaPoint[] = Array.from(vannaMap.entries())
    .map(([strike, vanna]) => ({ strike, vanna }))
    .sort((a, b) => a.strike - b.strike);

  // Key levels
  const calls = options.filter((o) => o.type === "call");
  const puts = options.filter((o) => o.type === "put");

  const callWall = calls.reduce((m, o) => (o.oi > m.oi ? o : m), calls[0])?.strike ?? spot;
  const putWall = puts.reduce((m, o) => (o.oi > m.oi ? o : m), puts[0])?.strike ?? spot;

  // Gamma flip: strike where cumulative GEX is closest to zero
  let cum = 0;
  let gammaFlip = gexProfile[0]?.strike ?? spot;
  let minAbs = Infinity;
  for (const p of gexProfile) {
    cum += p.gex;
    if (Math.abs(cum) < minAbs) {
      minAbs = Math.abs(cum);
      gammaFlip = p.strike;
    }
  }

  const support = gexProfile.reduce((m, p) => (p.gex > m.gex ? p : m), gexProfile[0])?.strike ?? spot;
  const resistance = gexProfile.reduce((m, p) => (p.gex < m.gex ? p : m), gexProfile[0])?.strike ?? spot;

  // Dealer hedging flow model
  const steps = 60;
  const prices: number[] = [];
  const flows: number[] = [];

  for (let i = 0; i < steps; i++) {
    const price = spot * (0.85 + (0.3 * i) / (steps - 1));
    prices.push(parseFloat(price.toFixed(2)));
    let total = 0;
    for (const opt of options) {
      const g = gammaBS(price, opt.strike, T, RISK_FREE_RATE, opt.iv);
      let gex = g * opt.oi * CONTRACT_SIZE * price * price;
      if (opt.type === "put") gex = -gex;
      total += gex;
    }
    flows.push(total);
  }

  return {
    ticker,
    spot,
    expiration,
    availableExpirations,
    levels: { callWall, putWall, gammaFlip, support, resistance },
    gexProfile,
    vannaProfile,
    dealerFlow: { prices, flows },
  };
}
