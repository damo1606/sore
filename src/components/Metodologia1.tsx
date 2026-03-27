"use client";

import { useState, useCallback, useEffect } from "react";
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

export default function Metodologia1({
  ticker,
  expiration,
  analyzeKey,
  companyName = "",
}: {
  ticker: string;
  expiration: string;
  analyzeKey: number;
  companyName?: string;
}) {
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
      setCandles(chartJson.candles ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (analyzeKey > 0 && ticker) {
      fetchAnalysis(ticker, expiration);
    }
  }, [analyzeKey]);

  const isPositiveGamma = data ? data.spot > data.levels.gammaFlip : null;

  return (
    <div>
      {error && (
        <div className="mx-6 mt-4 p-4 border border-danger text-danger text-sm tracking-wide">
          ✕ {error}
        </div>
      )}

      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center h-[70vh] gap-6 text-muted">
          <div className="relative">
            <div className="w-24 h-24 border border-border flex items-center justify-center text-5xl text-border">◈</div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-base tracking-widest font-semibold text-subtle">INGRESA UN TICKER Y PRESIONA ANALIZAR</p>
            <p className="text-xs text-muted opacity-60 tracking-widest">FLUJO INSTITUCIONAL · GEX · VANNA · DEALER FLOW</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 max-w-md">
            {["SPY", "QQQ", "NVDA", "AAPL", "TSLA", "MSFT", "AMZN", "GOOGL", "META", "AMD"].map((t) => (
              <div key={t} className="px-3 py-1 border border-border text-xs font-mono text-muted tracking-widest">
                {t}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-base text-muted tracking-widest">OBTENIENDO DATOS DE OPCIONES...</p>
          </div>
        </div>
      )}

      {data && !loading && (
        <main className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="flex flex-wrap items-end gap-4 sm:gap-8">
            <div>
              <div className="text-xs text-muted tracking-widest mb-1">PRECIO SPOT</div>
              <div className="text-4xl sm:text-6xl font-bold text-muted">${data.spot.toFixed(2)}</div>
            </div>
            <div className="border-l-2 border-border pl-4 sm:pl-8">
              <div className="text-xs text-muted tracking-widest mb-1">RÉGIMEN GAMMA</div>
              <div className={`text-xl sm:text-3xl font-bold tracking-wide ${isPositiveGamma ? "text-accent" : "text-danger"}`}>
                {isPositiveGamma ? "▲ GAMMA POSITIVO" : "▼ GAMMA NEGATIVO"}
              </div>
            </div>
            <div className="border-l-2 border-border pl-4 sm:pl-8">
              <div className="text-xs text-muted tracking-widest mb-1">VENCIMIENTO</div>
              <div className="text-xl sm:text-3xl font-bold text-subtle">{data.expiration}</div>
            </div>
            <div className="border-l-2 border-border pl-4 sm:pl-8">
              <div className="text-xs text-muted tracking-widest mb-1">TICKER</div>
              <div className="text-xl sm:text-3xl font-bold text-accent">{data.ticker}</div>
              {companyName && <div className="text-xs text-muted mt-1">{companyName}</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-card border border-border p-6">
              <div className="text-sm text-muted tracking-widest mb-3 font-semibold">PRESIÓN INSTITUCIONAL</div>
              <div className={`text-4xl font-bold mb-3 ${data.institutionalPressure >= 0 ? "text-accent" : "text-danger"}`}>
                {data.institutionalPressure >= 0 ? "+" : ""}{data.institutionalPressure.toFixed(1)}%
              </div>
              <div className="w-full h-4 bg-surface border border-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${data.institutionalPressure >= 0 ? "bg-accent" : "bg-danger"}`}
                  style={{ width: `${Math.min(Math.abs(data.institutionalPressure) * 0.5, 50)}%`, marginLeft: data.institutionalPressure >= 0 ? "50%" : `${Math.max(50 - Math.abs(data.institutionalPressure) * 0.5, 0)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted mt-1">
                <span>BAJISTA</span><span>NEUTRAL</span><span>ALCISTA</span>
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
              <div className="text-sm text-muted tracking-widest mb-3 font-semibold">RATIO PUT / CALL</div>
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
                <span>0 — ALCISTA</span><span>1.0</span><span>2.0 — BAJISTA</span>
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

          <LevelsPanel levels={data.levels} spot={data.spot} />

          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-5 font-semibold">
              PRECIO — VELAS JAPONESAS + NIVELES INSTITUCIONALES (3 MESES)
            </div>
            <CandlestickChart candles={candles} levels={data.levels} spot={data.spot} />
          </div>

          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-5 font-semibold">
              PERFIL DE GAMMA EXPOSURE — GEX POR STRIKE
            </div>
            <GexChart data={data.gexProfile} spot={data.spot} levels={data.levels} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border p-6">
              <div className="text-sm text-muted tracking-widest mb-5 font-semibold">MODELO DE FLUJO DE COBERTURA DEALER</div>
              <DealerFlowChart
                prices={data.dealerFlow.prices}
                flows={data.dealerFlow.flows}
                spot={data.spot}
                gammaFlip={data.levels.gammaFlip}
              />
            </div>
            <div className="bg-card border border-border p-6">
              <div className="text-sm text-muted tracking-widest mb-5 font-semibold">EXPOSICIÓN VANNA POR STRIKE</div>
              <VannaChart data={data.vannaProfile} spot={data.spot} />
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
