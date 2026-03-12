import { gammaBS } from "./blackscholes";
import type { Analysis3Result, AggStrikeData } from "@/types";

const RISK_FREE_RATE = 0.043;
const CONTRACT_SIZE = 100;
const MAX_DISTANCE = 0.15;
const MIN_OI = 5;

interface RawOption {
  strike: number;
  impliedVolatility: number;
  openInterest: number;
}

export interface ExpData {
  expiration: string;
  calls: RawOption[];
  puts: RawOption[];
}

function zscore(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  if (std === 0) return values.map(() => 0);
  return values.map((v) => (v - mean) / std);
}

export function computeAnalysis3(
  ticker: string,
  spot: number,
  expDataList: ExpData[]
): Analysis3Result {
  const today = new Date();

  // Accumulate per-strike data across all expirations
  const strikeMap = new Map<number, {
    gexSum: number;
    callOISum: number;
    putOISum: number;
    expCount: number;
  }>();

  for (const expData of expDataList) {
    const expDate = new Date(expData.expiration + "T00:00:00");
    const T = Math.max(
      (expDate.getTime() - today.getTime()) / (365 * 24 * 60 * 60 * 1000),
      0.001
    );

    const allStrikes = Array.from(
      new Set([...expData.calls.map((c) => c.strike), ...expData.puts.map((p) => p.strike)])
    );

    for (const strike of allStrikes) {
      const call = expData.calls.find((c) => c.strike === strike);
      const put = expData.puts.find((p) => p.strike === strike);

      const callOI = call?.openInterest ?? 0;
      const putOI = put?.openInterest ?? 0;
      const callIV = call?.impliedVolatility ?? 0;
      const putIV = put?.impliedVolatility ?? 0;

      const gCall = gammaBS(spot, strike, T, RISK_FREE_RATE, callIV);
      const gPut = gammaBS(spot, strike, T, RISK_FREE_RATE, putIV);

      const gexCall = callOI * gCall * spot * spot * CONTRACT_SIZE;
      const gexPut = -(putOI * gPut * spot * spot * CONTRACT_SIZE);
      const gex = gexCall + gexPut;

      const existing = strikeMap.get(strike) ?? {
        gexSum: 0, callOISum: 0, putOISum: 0, expCount: 0,
      };
      strikeMap.set(strike, {
        gexSum: existing.gexSum + gex,
        callOISum: existing.callOISum + callOI,
        putOISum: existing.putOISum + putOI,
        expCount: existing.expCount + 1,
      });
    }
  }

  // Build filtered strike array (±15% from spot, min OI)
  const lower = spot * (1 - MAX_DISTANCE);
  const upper = spot * (1 + MAX_DISTANCE);

  let strikes: AggStrikeData[] = Array.from(strikeMap.entries())
    .filter(([strike, d]) =>
      strike >= lower &&
      strike <= upper &&
      d.callOISum + d.putOISum >= MIN_OI
    )
    .map(([strike, d]) => ({
      strike,
      totalGEX: d.gexSum,
      totalOI: d.callOISum + d.putOISum,
      weightedPCR: d.callOISum > 0 ? d.putOISum / d.callOISum : 1,
      expirationCount: d.expCount,
      zGex: 0,
      zOI: 0,
      zPcr: 0,
      confluenceScore: 0,
    }))
    .sort((a, b) => a.strike - b.strike);

  // Fallback: relax OI filter
  if (strikes.length < 5) {
    strikes = Array.from(strikeMap.entries())
      .filter(([strike]) => strike >= lower && strike <= upper)
      .map(([strike, d]) => ({
        strike,
        totalGEX: d.gexSum,
        totalOI: d.callOISum + d.putOISum,
        weightedPCR: d.callOISum > 0 ? d.putOISum / d.callOISum : 1,
        expirationCount: d.expCount,
        zGex: 0, zOI: 0, zPcr: 0, confluenceScore: 0,
      }))
      .sort((a, b) => a.strike - b.strike);
  }

  // Z-score normalize 3 dimensions simultaneously
  const zGexArr = zscore(strikes.map((d) => d.totalGEX));
  const zOIArr  = zscore(strikes.map((d) => d.totalOI));
  const zPcrArr = zscore(strikes.map((d) => d.weightedPCR));

  strikes.forEach((d, i) => {
    d.zGex = zGexArr[i];
    d.zOI  = zOIArr[i];
    d.zPcr = zPcrArr[i];
    // Confluence: positive GEX + high OI + high PCR = strong support signal
    // Confluence: negative GEX + high OI + low PCR = strong resistance signal
    d.confluenceScore = d.zGex + d.zOI + d.zPcr;
  });

  // Support: below spot, positive GEX (dealer long gamma → pinning), PCR > 1
  let supports = strikes.filter(
    (d) => d.strike < spot && d.totalGEX > 0 && d.weightedPCR > 1
  );
  if (supports.length === 0) supports = strikes.filter((d) => d.strike < spot);
  const supportRow = supports.reduce(
    (best, d) => (d.confluenceScore > best.confluenceScore ? d : best),
    supports[0]
  );

  // Resistance: above spot, negative GEX (dealer short gamma → fuel for move), PCR < 1
  let resistances = strikes.filter(
    (d) => d.strike > spot && d.totalGEX < 0 && d.weightedPCR < 1
  );
  if (resistances.length === 0) resistances = strikes.filter((d) => d.strike > spot);
  const resistanceRow = resistances.reduce(
    (best, d) => (d.confluenceScore < best.confluenceScore ? d : best),
    resistances[0]
  );

  // Convert confluence extremes to 0-100 confidence
  const allAbs = strikes.map((d) => Math.abs(d.confluenceScore));
  const maxAbs = Math.max(...allAbs, 1);
  const toConfidence = (score: number) =>
    Math.min(100, Math.round((Math.abs(score) / maxAbs) * 100));

  return {
    ticker,
    spot,
    expiration: expDataList[0]?.expiration ?? "",
    availableExpirations: [] as string[], // filled by the route
    expirationsUsed: expDataList.map((e) => e.expiration),
    support: supportRow?.strike ?? spot * 0.97,
    resistance: resistanceRow?.strike ?? spot * 1.03,
    supportConfidence: supportRow ? toConfidence(supportRow.confluenceScore) : 50,
    resistanceConfidence: resistanceRow ? toConfidence(resistanceRow.confluenceScore) : 50,
    filteredStrikes: strikes,
  };
}
