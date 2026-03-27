"use client";

import { useState, useCallback, useEffect } from "react";
import type { Analysis2Result } from "@/types";
import CandlestickChart from "@/components/CandlestickChart";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Cell, ResponsiveContainer,
} from "recharts";

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

const fmtB = (v: number) => `${(v / 1e9).toFixed(2)}B`;

export default function Metodologia2({
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
  const [data, setData] = useState<Analysis2Result | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAnalysis = useCallback(async (t: string, exp: string) => {
    setLoading(true);
    setError("");
    try {
      const url = exp
        ? `/api/analysis2?ticker=${t}&expiration=${exp}`
        : `/api/analysis2?ticker=${t}`;

      const [analysisRes, chartRes] = await Promise.all([
        fetch(url),
        fetch(`/api/chart?ticker=${t}&range=5mo`),
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

  const candleLevels = data
    ? {
        callWall: data.resistance,
        resistance: data.resistance,
        gammaFlip: (data.support + data.resistance) / 2,
        support: data.support,
        putWall: data.support,
      }
    : null;

  return (
    <div>
      {error && (
        <div className="mx-6 mt-4 p-4 border border-danger text-danger text-sm">✕ {error}</div>
      )}

      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4 text-muted">
          <div className="w-20 h-20 border-2 border-border flex items-center justify-center text-4xl">◈</div>
          <p className="text-base tracking-widest">ENTER ANY US TICKER AND CLICK ANALYZE</p>
          <p className="text-sm opacity-60">SPY · QQQ · NVDA · AAPL · TSLA · MSFT · AMZN · GOOGL · META · AMD</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-base text-muted tracking-widest">FETCHING OPTIONS DATA...</p>
          </div>
        </div>
      )}

      {data && !loading && (
        <main className="p-6 space-y-6">
          <div className="flex flex-wrap items-end gap-8">
            <div>
              <div className="text-sm text-muted tracking-widest mb-1">SPOT PRICE</div>
              <div className="text-6xl font-bold text-muted">${data.spot.toFixed(2)}</div>
            </div>
            <div className="border-l-2 border-border pl-8">
              <div className="text-sm text-muted tracking-widest mb-1">TICKER</div>
              <div className="text-3xl font-bold text-accent">{data.ticker}</div>
              {companyName && <div className="text-xs text-muted mt-1">{companyName}</div>}
            </div>
            <div className="border-l-2 border-border pl-8">
              <div className="text-sm text-muted tracking-widest mb-1">VENCIMIENTO</div>
              <div className="text-3xl font-bold text-subtle">{data.expiration}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-card border-t-4 border-t-accent border border-border p-6">
              <div className="text-sm text-muted tracking-widest mb-2 font-semibold">SOPORTE INSTITUCIONAL</div>
              <div className="text-5xl font-bold text-accent">${data.support.toFixed(2)}</div>
              <div className="text-sm text-subtle mt-2">
                {(((data.support - data.spot) / data.spot) * 100).toFixed(2)}% vs spot
              </div>
              <div className="text-xs text-muted mt-2">
                Strike con mayor presión institucional — GEX positivo + PCR &gt; 1
              </div>
            </div>
            <div className="bg-card border-t-4 border-t-danger border border-border p-6">
              <div className="text-sm text-muted tracking-widest mb-2 font-semibold">RESISTENCIA INSTITUCIONAL</div>
              <div className="text-5xl font-bold text-danger">${data.resistance.toFixed(2)}</div>
              <div className="text-sm text-subtle mt-2">
                +{(((data.resistance - data.spot) / data.spot) * 100).toFixed(2)}% vs spot
              </div>
              <div className="text-xs text-muted mt-2">
                Strike con menor presión institucional — GEX negativo + PCR &lt; 1
              </div>
            </div>
          </div>

          {candleLevels && (
            <div className="bg-card border border-border p-6">
              <div className="text-sm text-muted tracking-widest mb-5 font-semibold">
                PRICE ACTION — VELAS JAPONESAS + NIVELES INSTITUCIONALES (5 MESES)
              </div>
              <CandlestickChart candles={candles} levels={candleLevels} spot={data.spot} />
            </div>
          )}

          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-5 font-semibold">
              GAMMA EXPOSURE (GEX) POR STRIKE — ±10% DEL SPOT
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.filteredStrikes} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
                <XAxis dataKey="strike" tick={{ fill: "#555", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} tickFormatter={fmtB} width={60} />
                <Tooltip
                  contentStyle={{ background: "#f9f9f9", border: "1px solid #e0e0e0", fontSize: 12 }}
                  formatter={(v: number) => [fmtB(v), "Total GEX"]}
                  labelFormatter={(l) => `Strike: $${l}`}
                />
                <ReferenceLine x={data.spot} stroke="#000" strokeWidth={2} label={{ value: "SPOT", fill: "#000", fontSize: 9 }} />
                <ReferenceLine x={data.support} stroke="#00a854" strokeDasharray="4 4" label={{ value: "SUP", fill: "#00a854", fontSize: 9 }} />
                <ReferenceLine x={data.resistance} stroke="#e53935" strokeDasharray="4 4" label={{ value: "RES", fill: "#e53935", fontSize: 9 }} />
                <ReferenceLine y={0} stroke="#ccc" />
                <Bar dataKey="totalGEX" radius={[2, 2, 0, 0]}>
                  {data.filteredStrikes.map((entry, i) => (
                    <Cell key={i} fill={entry.totalGEX >= 0 ? "#00a854" : "#e53935"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-5 font-semibold">
              PUT / CALL RATIO POR STRIKE
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.filteredStrikes} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
                <XAxis dataKey="strike" tick={{ fill: "#555", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} width={50} />
                <Tooltip
                  contentStyle={{ background: "#f9f9f9", border: "1px solid #e0e0e0", fontSize: 12 }}
                  formatter={(v: number) => [v.toFixed(2), "PCR"]}
                  labelFormatter={(l) => `Strike: $${l}`}
                />
                <ReferenceLine y={1} stroke="#f9a825" strokeDasharray="4 4" label={{ value: "PCR=1", fill: "#f9a825", fontSize: 9 }} />
                <ReferenceLine x={data.spot} stroke="#000" strokeWidth={2} />
                <ReferenceLine x={data.support} stroke="#00a854" strokeDasharray="4 4" />
                <ReferenceLine x={data.resistance} stroke="#e53935" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="pcr" stroke="#1565c0" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-5 font-semibold">
              INSTITUTIONAL PRESSURE SCORE — Z(GEX) + Z(PCR)
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.filteredStrikes} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
                <XAxis dataKey="strike" tick={{ fill: "#555", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} width={50} />
                <Tooltip
                  contentStyle={{ background: "#f9f9f9", border: "1px solid #e0e0e0", fontSize: 12 }}
                  formatter={(v: number) => [v.toFixed(2), "Pressure"]}
                  labelFormatter={(l) => `Strike: $${l}`}
                />
                <ReferenceLine y={0} stroke="#ccc" />
                <ReferenceLine x={data.spot} stroke="#000" strokeWidth={2} label={{ value: "SPOT", fill: "#000", fontSize: 9 }} />
                <ReferenceLine x={data.support} stroke="#00a854" strokeDasharray="4 4" label={{ value: "SUP", fill: "#00a854", fontSize: 9 }} />
                <ReferenceLine x={data.resistance} stroke="#e53935" strokeDasharray="4 4" label={{ value: "RES", fill: "#e53935", fontSize: 9 }} />
                <Bar dataKey="institutionalPressure" radius={[2, 2, 0, 0]}>
                  {data.filteredStrikes.map((entry, i) => (
                    <Cell key={i} fill={entry.institutionalPressure >= 0 ? "#00a854" : "#e53935"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── RESUMEN M2 ─────────────────────────────────────────────────────── */}
          {(() => {
            const rangeAmp = (data.resistance - data.support) / data.spot * 100;
            const posInRange = data.resistance > data.support
              ? (data.spot - data.support) / (data.resistance - data.support) * 100
              : 50;
            const midIdx = Math.floor(data.filteredStrikes.length / 2);
            const lastPCR = data.filteredStrikes[midIdx]?.pcr ?? 1;
            const pcrSignal = lastPCR > 1.2 ? "BAJISTA" : lastPCR < 0.8 ? "ALCISTA" : "NEUTRAL";
            const pcrColor  = lastPCR > 1.2 ? "text-danger border-danger" : lastPCR < 0.8 ? "text-accent border-accent" : "text-warning border-warning";
            const rangeColor = posInRange > 70 ? "text-danger border-danger" : posInRange < 30 ? "text-accent border-accent" : "text-warning border-warning";
            return (
              <div className="bg-card border border-border p-6">
                <div className="text-sm text-muted tracking-widest mb-4 font-semibold">RESUMEN — INTERPRETACIÓN</div>
                <div className="space-y-3">
                  <div className={`border-l-4 pl-4 py-2 ${rangeColor}`}>
                    <div className={`text-sm font-bold ${rangeColor.split(" ")[0]}`}>
                      POSICIÓN EN RANGO: {posInRange.toFixed(0)}% · AMPLITUD {rangeAmp.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {posInRange > 70
                        ? `Spot cerca de la resistencia ($${data.resistance.toFixed(2)}). El precio está en la parte alta del rango de opciones — probabilidad de rechazo o consolidación.`
                        : posInRange < 30
                        ? `Spot cerca del soporte ($${data.support.toFixed(2)}). El precio está en la parte baja del rango — zona con potencial rebote institucional.`
                        : `Spot en zona media del rango ($${data.support.toFixed(2)} – $${data.resistance.toFixed(2)}). Sin presión clara desde ninguno de los extremos.`}
                    </div>
                  </div>
                  <div className={`border-l-4 pl-4 py-2 ${pcrColor}`}>
                    <div className={`text-sm font-bold ${pcrColor.split(" ")[0]}`}>
                      PCR (PUT/CALL RATIO): {lastPCR.toFixed(2)} — SESGO {pcrSignal}
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {lastPCR > 1.2
                        ? "El volumen de puts supera ampliamente al de calls. El mercado está comprando protección bajista — señal de precaución."
                        : lastPCR < 0.8
                        ? "El volumen de calls supera al de puts. Los participantes están posicionándose al alza con más agresividad."
                        : "El ratio puts/calls está en zona neutral. Sin sesgo direccional claro en el posicionamiento de opciones."}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </main>
      )}
    </div>
  );
}
