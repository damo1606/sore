"use client";

import { useState, useCallback } from "react";
import type { AnalysisResult } from "@/types";
import LevelsPanel from "@/components/LevelsPanel";
import GexChart from "@/components/GexChart";
import DealerFlowChart from "@/components/DealerFlowChart";
import VannaChart from "@/components/VannaChart";
import CandlestickChart from "@/components/CandlestickChart";

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export default function Metodologia1() {
  const [ticker, setTicker] = useState("SPY");
  const [expiration, setExpiration] = useState("");
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAnalysis = useCallback(async (t: string, exp: string) => {
    setLoading(true);
    setError("");
    try {
      const url = exp
        ? `/api/analysis?ticker=${t}&expiration=${exp}`
        : `/api/analysis?ticker=${t}`;

      const [analysisRes, chartRes] = await Promise.all([
        fetch(url),
        fetch(`/api/chart?ticker=${t}&range=3mo`),
      ]);

      const analysisJson = await analysisRes.json();
      if (!analysisRes.ok) throw new Error(analysisJson.error ?? "Error");

      const chartJson = await chartRes.json();

      setData(analysisJson);
      setExpiration(analysisJson.expiration);
      setCandles(chartJson.candles ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  async function analyze() {
    if (!ticker.trim()) return;
    await fetchAnalysis(ticker, expiration);
  }

  async function handleExpirationChange(exp: string) {
    setExpiration(exp);
    await fetchAnalysis(ticker, exp);
  }

  const isPositiveGamma = data ? data.spot > data.levels.gammaFlip : null;

  return (
    <div>
      {/* Controls */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-3 bg-surface">
        <input
          className="bg-bg border border-border text-gray-900 px-4 py-2 text-base uppercase tracking-widest w-28 focus:outline-none focus:border-accent transition-colors"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && analyze()}
          placeholder="TICKER"
          maxLength={6}
        />
        {data && data.availableExpirations.length > 0 && (
          <select
            className="bg-bg border border-border text-gray-900 px-3 py-2 text-base focus:outline-none focus:border-accent transition-colors"
            value={expiration}
            onChange={(e) => handleExpirationChange(e.target.value)}
          >
            {data.availableExpirations.map((exp) => (
              <option key={exp} value={exp}>{exp}</option>
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

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-4 border border-danger text-danger text-sm tracking-wide">
          ✕ {error}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4 text-muted">
          <div className="w-20 h-20 border-2 border-border flex items-center justify-center text-4xl">◈</div>
          <p className="text-base tracking-widest">ENTER A TICKER AND CLICK ANALYZE</p>
          <p className="text-sm opacity-60">SPY · QQQ · NVDA · AAPL · TSLA · DIA</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-base text-muted tracking-widest">FETCHING OPTIONS DATA...</p>
          </div>
        </div>
      )}

      {/* Dashboard */}
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

          {/* Institutional Pressure + Put/Call Ratio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-card border border-border p-6">
              <div className="text-sm text-muted tracking-widest mb-3 font-semibold">INSTITUTIONAL PRESSURE</div>
              <div className={`text-4xl font-bold mb-3 ${data.institutionalPressure >= 0 ? "text-accent" : "text-danger"}`}>
                {data.institutionalPressure >= 0 ? "+" : ""}{data.institutionalPressure.toFixed(1)}%
              </div>
              <div className="w-full h-4 bg-surface border border-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${data.institutionalPressure >= 0 ? "bg-accent" : "bg-danger"}`}
                  style={{ width: `${Math.min(Math.abs(data.institutionalPressure), 100)}%`, marginLeft: data.institutionalPressure >= 0 ? "50%" : `${50 - Math.min(Math.abs(data.institutionalPressure), 50)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted mt-1">
                <span>BEARISH</span><span>NEUTRAL</span><span>BULLISH</span>
              </div>
              <div className="text-xs text-muted mt-3">
                {data.institutionalPressure >= 20 ? "Dealers fuertemente posicionados al alza"
                  : data.institutionalPressure >= 5 ? "Sesgo alcista moderado — soporte institucional"
                  : data.institutionalPressure >= -5 ? "Posicionamiento neutral — mercado en equilibrio"
                  : data.institutionalPressure >= -20 ? "Sesgo bajista moderado — presión vendedora"
                  : "Dealers fuertemente posicionados a la baja"}
              </div>
            </div>

            <div className="bg-card border border-border p-6">
              <div className="text-sm text-muted tracking-widest mb-3 font-semibold">PUT / CALL RATIO</div>
              <div className={`text-4xl font-bold mb-3 ${data.putCallRatio > 1.2 ? "text-danger" : data.putCallRatio < 0.7 ? "text-accent" : "text-warning"}`}>
                {data.putCallRatio.toFixed(2)}
              </div>
              <div className="w-full h-4 bg-surface border border-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${data.putCallRatio > 1.2 ? "bg-danger" : data.putCallRatio < 0.7 ? "bg-accent" : "bg-warning"}`}
                  style={{ width: `${Math.min((data.putCallRatio / 2) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted mt-1">
                <span>0 — BULLISH</span><span>1.0</span><span>2.0 — BEARISH</span>
              </div>
              <div className="text-xs text-muted mt-3">
                {data.putCallRatio > 1.5 ? "Miedo extremo — hedging institucional masivo"
                  : data.putCallRatio > 1.2 ? "Sesgo bajista — más puts que calls"
                  : data.putCallRatio > 0.9 ? "Mercado balanceado — sin sesgo claro"
                  : data.putCallRatio > 0.7 ? "Sesgo alcista — más calls que puts"
                  : "Optimismo extremo — alta demanda de calls"}
              </div>
            </div>
          </div>

          {/* Key Levels */}
          <LevelsPanel levels={data.levels} spot={data.spot} />

          {/* Candlestick Chart */}
          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-5 font-semibold">
              PRICE ACTION — JAPANESE CANDLESTICKS + INSTITUTIONAL LEVELS (3 MONTHS)
            </div>
            <CandlestickChart candles={candles} levels={data.levels} spot={data.spot} />
          </div>

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
              <div className="text-sm text-muted tracking-widest mb-5 font-semibold">DEALER HEDGING FLOW MODEL</div>
              <DealerFlowChart
                prices={data.dealerFlow.prices}
                flows={data.dealerFlow.flows}
                spot={data.spot}
                gammaFlip={data.levels.gammaFlip}
              />
            </div>
            <div className="bg-card border border-border p-6">
              <div className="text-sm text-muted tracking-widest mb-5 font-semibold">VANNA EXPOSURE BY STRIKE</div>
              <VannaChart data={data.vannaProfile} spot={data.spot} />
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
