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
    <div className="min-h-screen bg-bg text-white">
      {/* ── Header ── */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 bg-bg z-50">
        <div className="flex items-center gap-4">
          <span className="text-accent font-bold text-lg tracking-[0.3em]">SORE</span>
          <span className="text-muted text-xs tracking-widest hidden sm:block">
            INSTITUTIONAL OPTIONS FLOW
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            className="bg-surface border border-border text-white px-3 py-1.5 text-sm uppercase tracking-widest w-24 focus:outline-none focus:border-accent transition-colors"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            placeholder="TICKER"
            maxLength={6}
          />

          {data && data.availableExpirations.length > 0 && (
            <select
              className="bg-surface border border-border text-white px-3 py-1.5 text-sm focus:outline-none focus:border-accent transition-colors"
              value={expiration}
              onChange={(e) => {
                setExpiration(e.target.value);
              }}
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
            className="bg-accent text-black px-5 py-1.5 text-sm font-bold tracking-widest hover:bg-green-300 disabled:opacity-40 transition-colors"
          >
            {loading ? "..." : "ANALYZE"}
          </button>
        </div>
      </header>

      {/* ── Error ── */}
      {error && (
        <div className="mx-6 mt-4 p-3 border border-danger text-danger text-xs tracking-wide">
          ✕ {error}
        </div>
      )}

      {/* ── Empty state ── */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center h-[80vh] gap-4 text-muted">
          <div className="w-16 h-16 border border-border flex items-center justify-center text-2xl text-border">
            ◈
          </div>
          <p className="text-xs tracking-widest">ENTER A TICKER AND CLICK ANALYZE</p>
          <p className="text-xs opacity-50">SPY · QQQ · NVDA · AAPL · TSLA · DIA</p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center h-[80vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted tracking-widest">FETCHING OPTIONS DATA...</p>
          </div>
        </div>
      )}

      {/* ── Dashboard ── */}
      {data && !loading && (
        <main className="p-6 space-y-5">
          {/* Spot + Gamma Regime */}
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <div className="text-xs text-muted tracking-widest mb-1">SPOT PRICE</div>
              <div className="text-5xl font-bold text-white">${data.spot.toFixed(2)}</div>
            </div>
            <div className="border-l border-border pl-6">
              <div className="text-xs text-muted tracking-widest mb-1">GAMMA REGIME</div>
              <div
                className={`text-2xl font-bold tracking-wide ${
                  isPositiveGamma ? "text-accent" : "text-danger"
                }`}
              >
                {isPositiveGamma ? "▲ POSITIVE GAMMA" : "▼ NEGATIVE GAMMA"}
              </div>
            </div>
            <div className="border-l border-border pl-6">
              <div className="text-xs text-muted tracking-widest mb-1">EXPIRATION</div>
              <div className="text-2xl font-bold text-subtle">{data.expiration}</div>
            </div>
            <div className="border-l border-border pl-6">
              <div className="text-xs text-muted tracking-widest mb-1">TICKER</div>
              <div className="text-2xl font-bold text-accent">{data.ticker}</div>
            </div>
          </div>

          {/* Key Levels */}
          <LevelsPanel levels={data.levels} spot={data.spot} />

          {/* GEX Profile */}
          <div className="bg-card border border-border p-5">
            <div className="text-xs text-muted tracking-widest mb-4">
              GAMMA EXPOSURE PROFILE — GEX BY STRIKE
            </div>
            <GexChart data={data.gexProfile} spot={data.spot} levels={data.levels} />
          </div>

          {/* Dealer Flow + Vanna */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-card border border-border p-5">
              <div className="text-xs text-muted tracking-widest mb-4">
                DEALER HEDGING FLOW MODEL
              </div>
              <DealerFlowChart
                prices={data.dealerFlow.prices}
                flows={data.dealerFlow.flows}
                spot={data.spot}
                gammaFlip={data.levels.gammaFlip}
              />
            </div>
            <div className="bg-card border border-border p-5">
              <div className="text-xs text-muted tracking-widest mb-4">
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
