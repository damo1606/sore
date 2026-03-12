"use client";

import { useState, useCallback } from "react";
import type { Analysis3Result } from "@/types";
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

function ConfidenceBadge({ value }: { value: number }) {
  const color =
    value >= 75 ? "text-accent" : value >= 45 ? "text-warning" : "text-muted";
  const label =
    value >= 75 ? "ALTA" : value >= 45 ? "MEDIA" : "BAJA";
  return (
    <div className={`flex items-center gap-2 ${color}`}>
      <div className="text-5xl font-bold">{value}%</div>
      <div className="text-sm font-bold tracking-widest">{label}</div>
    </div>
  );
}

export default function Metodologia3() {
  const [ticker, setTicker] = useState("SPY");
  const [expiration, setExpiration] = useState("");
  const [allExpirations, setAllExpirations] = useState<string[]>([]);
  const [data, setData] = useState<Analysis3Result | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAnalysis = useCallback(async (t: string, exp: string) => {
    setLoading(true);
    setError("");
    try {
      const url = exp
        ? `/api/analysis3?ticker=${t}&expiration=${exp}`
        : `/api/analysis3?ticker=${t}`;

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
    try {
      const expRes = await fetch(`/api/expirations?ticker=${ticker}`);
      const expJson = await expRes.json();
      if (expRes.ok && expJson.expirations?.length > 0) {
        setAllExpirations(expJson.expirations);
        const firstExp = expiration || expJson.expirations[0];
        setExpiration(firstExp);
        await fetchAnalysis(ticker, firstExp);
      } else {
        await fetchAnalysis(ticker, expiration);
      }
    } catch {
      await fetchAnalysis(ticker, expiration);
    }
  }

  async function handleExpirationChange(exp: string) {
    setExpiration(exp);
    await fetchAnalysis(ticker, exp);
  }

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
      {/* Controls */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-3 bg-surface flex-wrap">
        <input
          className="bg-bg border border-border text-gray-900 px-4 py-2 text-base uppercase tracking-widest w-28 focus:outline-none focus:border-accent transition-colors"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && analyze()}
          placeholder="TICKER"
          maxLength={10}
        />
        {allExpirations.length > 0 && (
          <select
            className="bg-bg border border-border text-gray-900 px-3 py-2 text-base focus:outline-none focus:border-accent transition-colors"
            value={expiration}
            onChange={(e) => handleExpirationChange(e.target.value)}
          >
            {Object.entries(
              allExpirations.reduce<Record<string, string[]>>((acc, exp) => {
                const label = new Date(exp + "T12:00:00").toLocaleString("en-US", { month: "long", year: "numeric" });
                if (!acc[label]) acc[label] = [];
                acc[label].push(exp);
                return acc;
              }, {})
            ).map(([monthLabel, dates]) => (
              <optgroup key={monthLabel} label={monthLabel}>
                {dates.map((exp) => (
                  <option key={exp} value={exp}>{exp}</option>
                ))}
              </optgroup>
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
        {allExpirations.length > 0 && (
          <span className="text-xs text-muted">{allExpirations.length} expirations available</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-4 border border-danger text-danger text-sm">✕ {error}</div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4 text-muted">
          <div className="w-20 h-20 border-2 border-border flex items-center justify-center text-4xl">◈</div>
          <p className="text-base tracking-widest">MODELO MULTI-EXPIRACIÓN — MÁXIMA CONFIABILIDAD</p>
          <p className="text-sm opacity-60">Z(GEX) + Z(OI) + Z(PCR) — modelo de confluencia de 3 dimensiones</p>
          <p className="text-sm opacity-40">SPY · QQQ · NVDA · AAPL · TSLA · MSFT · AMZN · GOOGL</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-base text-muted tracking-widest">AGREGANDO VENCIMIENTOS...</p>
          </div>
        </div>
      )}

      {/* Dashboard */}
      {data && !loading && (
        <main className="p-6 space-y-6">

          {/* Spot */}
          <div className="flex flex-wrap items-end gap-8">
            <div>
              <div className="text-sm text-muted tracking-widest mb-1">SPOT PRICE</div>
              <div className="text-6xl font-bold text-gray-900">${data.spot.toFixed(2)}</div>
            </div>
            <div className="border-l-2 border-border pl-8">
              <div className="text-sm text-muted tracking-widest mb-1">TICKER</div>
              <div className="text-3xl font-bold text-accent">{data.ticker}</div>
            </div>
            <div className="border-l-2 border-border pl-8">
              <div className="text-sm text-muted tracking-widest mb-1">EXPIRATION</div>
              <div className="text-3xl font-bold text-subtle">{data.expiration}</div>
            </div>
          </div>

          {/* Support / Resistance with confidence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-card border-t-4 border-t-accent border border-border p-6">
              <div className="text-sm text-muted tracking-widest mb-3 font-semibold">
                SOPORTE INSTITUCIONAL AGREGADO
              </div>
              <div className="text-5xl font-bold text-accent mb-3">${data.support.toFixed(2)}</div>
              <div className="text-sm text-subtle mb-4">
                {(((data.support - data.spot) / data.spot) * 100).toFixed(2)}% vs spot
              </div>
              <div className="border-t border-border pt-4">
                <div className="text-xs text-muted tracking-widest mb-2">CONFIANZA DEL NIVEL</div>
                <ConfidenceBadge value={data.supportConfidence} />
                <div className="w-full h-2 bg-surface border border-border rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${data.supportConfidence}%` }}
                  />
                </div>
              </div>
              <div className="text-xs text-muted mt-3">
                Z(GEX) + Z(OI) + Z(PCR) — confluencia máxima por debajo del spot
              </div>
            </div>

            <div className="bg-card border-t-4 border-t-danger border border-border p-6">
              <div className="text-sm text-muted tracking-widest mb-3 font-semibold">
                RESISTENCIA INSTITUCIONAL AGREGADA
              </div>
              <div className="text-5xl font-bold text-danger mb-3">${data.resistance.toFixed(2)}</div>
              <div className="text-sm text-subtle mb-4">
                +{(((data.resistance - data.spot) / data.spot) * 100).toFixed(2)}% vs spot
              </div>
              <div className="border-t border-border pt-4">
                <div className="text-xs text-muted tracking-widest mb-2">CONFIANZA DEL NIVEL</div>
                <ConfidenceBadge value={data.resistanceConfidence} />
                <div className="w-full h-2 bg-surface border border-border rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full bg-danger rounded-full transition-all"
                    style={{ width: `${data.resistanceConfidence}%` }}
                  />
                </div>
              </div>
              <div className="text-xs text-muted mt-3">
                Z(GEX) + Z(OI) + Z(PCR) — confluencia mínima por encima del spot
              </div>
            </div>
          </div>

          {/* Candlestick */}
          {candleLevels && (
            <div className="bg-card border border-border p-6">
              <div className="text-sm text-muted tracking-widest mb-5 font-semibold">
                PRICE ACTION — NIVELES INSTITUCIONALES AGREGADOS (3 MESES)
              </div>
              <CandlestickChart candles={candles} levels={candleLevels} spot={data.spot} />
            </div>
          )}

          {/* Aggregated GEX */}
          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-5 font-semibold">
              GAMMA EXPOSURE (GEX) POR STRIKE — ±15% DEL SPOT
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.filteredStrikes} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
                <XAxis dataKey="strike" tick={{ fill: "#555", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} tickFormatter={fmtB} width={60} />
                <Tooltip
                  contentStyle={{ background: "#f9f9f9", border: "1px solid #e0e0e0", fontSize: 12 }}
                  formatter={(v: number) => [fmtB(v), "GEX Agregado"]}
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

          {/* Confluence Score */}
          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-5 font-semibold">
              CONFLUENCE SCORE — Z(GEX) + Z(OI) + Z(PCR)
            </div>
            <div className="text-xs text-muted mb-4">
              Valores altos = soporte fuerte · Valores bajos = resistencia fuerte
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.filteredStrikes} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
                <XAxis dataKey="strike" tick={{ fill: "#555", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} width={50} />
                <Tooltip
                  contentStyle={{ background: "#f9f9f9", border: "1px solid #e0e0e0", fontSize: 12 }}
                  formatter={(v: number) => [v.toFixed(3), "Confluence"]}
                  labelFormatter={(l) => `Strike: $${l}`}
                />
                <ReferenceLine y={0} stroke="#ccc" />
                <ReferenceLine x={data.spot} stroke="#000" strokeWidth={2} label={{ value: "SPOT", fill: "#000", fontSize: 9 }} />
                <ReferenceLine x={data.support} stroke="#00a854" strokeDasharray="4 4" label={{ value: "SUP", fill: "#00a854", fontSize: 9 }} />
                <ReferenceLine x={data.resistance} stroke="#e53935" strokeDasharray="4 4" label={{ value: "RES", fill: "#e53935", fontSize: 9 }} />
                <Bar dataKey="confluenceScore" radius={[2, 2, 0, 0]}>
                  {data.filteredStrikes.map((entry, i) => (
                    <Cell key={i} fill={entry.confluenceScore >= 0 ? "#00a854" : "#e53935"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Weighted PCR */}
          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-5 font-semibold">
              PCR PONDERADO POR OI — MULTI-EXPIRACIÓN
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.filteredStrikes} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
                <XAxis dataKey="strike" tick={{ fill: "#555", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} width={50} />
                <Tooltip
                  contentStyle={{ background: "#f9f9f9", border: "1px solid #e0e0e0", fontSize: 12 }}
                  formatter={(v: number) => [v.toFixed(2), "PCR Ponderado"]}
                  labelFormatter={(l) => `Strike: $${l}`}
                />
                <ReferenceLine y={1} stroke="#f9a825" strokeDasharray="4 4" label={{ value: "PCR=1", fill: "#f9a825", fontSize: 9 }} />
                <ReferenceLine x={data.spot} stroke="#000" strokeWidth={2} />
                <ReferenceLine x={data.support} stroke="#00a854" strokeDasharray="4 4" />
                <ReferenceLine x={data.resistance} stroke="#e53935" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="weightedPCR" stroke="#1565c0" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

        </main>
      )}
    </div>
  );
}
