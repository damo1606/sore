"use client";

import { useState } from "react";
import axios from "axios";
import { AnalysisData } from "@/types";
import LevelsPanel from "@/components/LevelsPanel";
import GexChart from "@/components/GexChart";
import DealerFlowChart from "@/components/DealerFlowChart";
import VannaChart from "@/components/VannaChart";

export default function Home() {
  const [ticker, setTicker] = useState("SPY");
  const [expiration, setExpiration] = useState("");
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    setLoading(true);
    setError("");
    try {
      const url = expiration
        ? `/api/analysis/${ticker}?expiration=${expiration}`
        : `/api/analysis/${ticker}`;
      const res = await axios.get(url);
      setData(res.data);
      setExpiration(res.data.expiration);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Error fetching data");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") analyze();
  }

  const bias =
    data && data.spot > data.levels.gamma_flip
      ? { label: "POSITIVE GAMMA", color: "text-accent" }
      : { label: "NEGATIVE GAMMA", color: "text-danger" };

  return (
    <div className="min-h-screen bg-bg font-mono">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-accent text-xl font-bold tracking-widest">SORE</span>
          <span className="text-muted text-xs">INSTITUTIONAL OPTIONS FLOW</span>
        </div>

        <div className="flex items-center gap-3">
          <input
            className="bg-surface border border-border text-white px-4 py-2 text-sm uppercase tracking-widest w-28 focus:outline-none focus:border-accent"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="TICKER"
          />
          {data && (
            <select
              className="bg-surface border border-border text-white px-3 py-2 text-sm focus:outline-none focus:border-accent"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
            >
              {data.available_expirations.map((exp) => (
                <option key={exp} value={exp}>{exp}</option>
              ))}
            </select>
          )}
          <button
            onClick={analyze}
            disabled={loading}
            className="bg-accent text-black px-6 py-2 text-sm font-bold tracking-widest hover:bg-green-400 disabled:opacity-50 transition-colors"
          >
            {loading ? "LOADING..." : "ANALYZE"}
          </button>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-3 border border-danger text-danger text-sm">
          {error}
        </div>
      )}

      {/* No data state */}
      {!data && !loading && (
        <div className="flex flex-col items-center justify-center h-[80vh] text-muted">
          <div className="text-6xl mb-4 text-border">◈</div>
          <p className="text-sm tracking-widest">ENTER A TICKER AND CLICK ANALYZE</p>
          <p className="text-xs mt-2">Supported: SPY, QQQ, DIA, AAPL, TSLA, NVDA...</p>
        </div>
      )}

      {/* Dashboard */}
      {data && (
        <main className="p-6 space-y-6">
          {/* Spot + Bias */}
          <div className="flex items-center gap-6">
            <div>
              <span className="text-muted text-xs tracking-widest">SPOT PRICE</span>
              <div className="text-4xl font-bold text-white">${data.spot.toFixed(2)}</div>
            </div>
            <div className="border-l border-border pl-6">
              <span className="text-muted text-xs tracking-widest">GAMMA REGIME</span>
              <div className={`text-2xl font-bold ${bias.color}`}>{bias.label}</div>
            </div>
            <div className="border-l border-border pl-6">
              <span className="text-muted text-xs tracking-widest">EXPIRATION</span>
              <div className="text-2xl font-bold">{data.expiration}</div>
            </div>
          </div>

          {/* Key Levels */}
          <LevelsPanel levels={data.levels} spot={data.spot} />

          {/* GEX Chart - full width */}
          <div className="bg-surface border border-border p-4">
            <h2 className="text-xs text-muted tracking-widest mb-4">GAMMA EXPOSURE PROFILE (GEX)</h2>
            <GexChart data={data.gex_profile} spot={data.spot} levels={data.levels} />
          </div>

          {/* Dealer Flow + Vanna - two columns */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-surface border border-border p-4">
              <h2 className="text-xs text-muted tracking-widest mb-4">DEALER HEDGING FLOW MODEL</h2>
              <DealerFlowChart
                prices={data.dealer_flow.prices}
                flows={data.dealer_flow.flows}
                spot={data.spot}
                gammaFlip={data.levels.gamma_flip}
              />
            </div>
            <div className="bg-surface border border-border p-4">
              <h2 className="text-xs text-muted tracking-widest mb-4">VANNA EXPOSURE PROFILE</h2>
              <VannaChart data={data.vanna_profile} spot={data.spot} />
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
