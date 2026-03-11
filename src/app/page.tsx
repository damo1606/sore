"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/types";
import LevelsPanel from "@/components/LevelsPanel";
import GexChart from "@/components/GexChart";
import DealerFlowChart from "@/components/DealerFlowChart";
import VannaChart from "@/components/VannaChart";

export default function Home() {
  const [ticker, setTicker] = useState("SPY");
  const [expiration, setExpiration] = useState("");
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    if (!ticker.trim()) return;
    setLoading(true);
    setError("");
    try {
      const url = expiration
        ? `/api/analysis?ticker=${ticker}&expiration=${expiration}`
        : `/api/analysis?ticker=${ticker}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      setData(json);
      setExpiration(json.expiration);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const isPositiveGamma = data ? data.spot > data.levels.gammaFlip : null;

  return (
    <div className="min-h-screen bg-bg text-gray-900">
      {/* ── Header ── */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 bg-bg z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="text-accent font-bold text-2xl tracking-[0.3em]">SORE</span>
          <span className="text-muted text-sm tracking-widest hidden sm:block">
            INSTITUTIONAL OPTIONS FLOW
          </span>
        </div>

        <div className="flex items-center gap-3">
          <input
            className="bg-surface border border-border text-gray-900 px-4 py-2 text-base uppercase tracking-widest w-28 focus:outline-none focus:border-accent transition-colors"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            placeholder="TICKER"
            maxLength={6}
          />

          {data && data.availableExpirations.length > 0 && (
            <select
              className="bg-surface border border-border text-gray-900 px-3 py-2 text-base focus:outline-none focus:border-accent transition-colors"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
            >
              {data.availableExpirations.map((exp) => (
                <option key={exp} value={exp}>
                  {exp}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={analyze}
            disabled={loading}
            className="bg-accent text-white px-6 py-2 text-base font-bold tracking-widest hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {loading ? "..." : "ANALYZE"}
          </button>
        </div>
      </header>

      {/* ── Error ── */}
      {error && (
        <div className="mx-6 mt-4 p-4 border border-danger text-danger text-sm tracking-wide">
          ✕ {error}
        </div>
      )}

      {/* ── Empty state ── */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center h-[80vh] gap-4 text-muted">
          <div className="w-20 h-20 border-2 border-border flex items-center justify-center text-4xl text-muted">
            ◈
          </div>
          <p className="text-base tracking-widest">ENTER A TICKER AND CLICK ANALYZE</p>
          <p className="text-sm opacity-60">SPY · QQQ · NVDA · AAPL · TSLA · DIA</p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center h-[80vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-base text-muted tracking-widest">FETCHING OPTIONS DATA...</p>
          </div>
        </div>
      )}

      {/* ── Dashboard ── */}
      {data && !loading && (
        <main className="p-6 space-y-6">
          {/* Spot + Gamma Regime */}
          <div className="flex flex-wrap items-end gap-8">
            <div>
              <div className="text-sm text-muted tracking-widest mb-1">SPOT PRICE</div>
              <div className="text-6xl font-bold text-gray-900">${data.spot.toFixed(2)}</div>
            </div>
            <div className="border-l-2 border-border pl-8">
              <div className="text-sm text-muted tracking-widest mb-1">GAMMA REGIME</div>
              <div className={`text-3xl font-bold tracking-wide ${isPositiveGamma ? "text-accent" : "text-danger"}`}>
                {isPositiveGamma ? "▲ POSITIVE GAMMA" : "▼ NEGATIVE GAMMA"}
              </div>
            </div>
            <div className="border-l-2 border-border pl-8">
              <div className="text-sm text-muted tracking-widest mb-1">EXPIRATION</div>
              <div className="text-3xl font-bold text-subtle">{data.expiration}</div>
            </div>
            <div className="border-l-2 border-border pl-8">
              <div className="text-sm text-muted tracking-widest mb-1">TICKER</div>
              <div className="text-3xl font-bold text-accent">{data.ticker}</div>
            </div>
          </div>

          {/* Key Levels */}
          <LevelsPanel levels={data.levels} spot={data.spot} />

          {/* GEX Profile */}
          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-5 font-semibold">
              GAMMA EXPOSURE PROFILE — GEX BY STRIKE
            </div>
            <GexChart data={data.gexProfile} spot={data.spot} levels={data.levels} />
          </div>

          {/* Dealer Flow + Vanna */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border p-6">
              <div className="text-sm text-muted tracking-widest mb-5 font-semibold">
                DEALER HEDGING FLOW MODEL
              </div>
              <DealerFlowChart
                prices={data.dealerFlow.prices}
                flows={data.dealerFlow.flows}
                spot={data.spot}
                gammaFlip={data.levels.gammaFlip}
              />
            </div>
            <div className="bg-card border border-border p-6">
              <div className="text-sm text-muted tracking-widest mb-5 font-semibold">
                VANNA EXPOSURE BY STRIKE
              </div>
              <VannaChart data={data.vannaProfile} spot={data.spot} />
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
