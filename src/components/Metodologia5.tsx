"use client";

import { useState, useCallback } from "react";
import type { Analysis5Result, SRLevel, SignalComponent, ScoredStrike } from "@/lib/gex5";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Cell, ResponsiveContainer,
} from "recharts";

const fmtNotional = (v: number) =>
  v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`;

// ─── Score bar (-100 to +100, 0 centered) ────────────────────────────────────
function ScoreBar({ value }: { value: number }) {
  const pct = Math.min(Math.abs(value) / 2, 50);
  const isPos = value >= 0;
  return (
    <div className="relative w-full h-5 bg-surface border border-border rounded-sm overflow-hidden">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border z-10" />
      <div
        className={`absolute top-1 bottom-1 rounded-sm transition-all ${isPos ? "bg-accent" : "bg-danger"}`}
        style={{
          left: isPos ? "50%" : `${50 - pct}%`,
          width: `${pct}%`,
        }}
      />
    </div>
  );
}

// ─── Sub-score bar (0 to 1) ───────────────────────────────────────────────────
function SubScore({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note?: string;
}) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "bg-accent" : pct >= 45 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex items-center gap-3">
      <div className="text-xs text-muted w-24 tracking-wider shrink-0">{label}</div>
      <div className="flex-1 h-2 bg-surface border border-border">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs font-bold text-subtle w-8 text-right">{pct}%</div>
      {note && <div className="text-xs text-muted">{note}</div>}
    </div>
  );
}

// ─── S/R Level card ───────────────────────────────────────────────────────────
function SRCard({
  level,
  spot,
  type,
}: {
  level: SRLevel | null;
  spot: number;
  type: "support" | "resistance";
}) {
  const isSupport = type === "support";
  const accentClass = isSupport ? "border-t-accent text-accent" : "border-t-danger text-danger";
  const title = isSupport ? "SOPORTE SÓLIDO" : "RESISTENCIA SÓLIDA";

  if (!level) {
    return (
      <div className="bg-card border-t-4 border-t-border border border-border p-6 flex flex-col items-center justify-center min-h-[220px] gap-2 text-muted">
        <div className="text-sm tracking-widest font-semibold">{title}</div>
        <div className="text-xs opacity-60 text-center">
          Nivel no disponible — los 3 filtros no convergieron
        </div>
      </div>
    );
  }

  const pctFromSpot = (((level.strike - spot) / spot) * 100).toFixed(2);
  const sign = level.strike > spot ? "+" : "";
  const confidenceLabel =
    level.confidence >= 70 ? "ALTA CONFIANZA" :
    level.confidence >= 45 ? "MEDIA" : "BAJA";
  const confColor =
    level.confidence >= 70 ? accentClass.split(" ")[1] :
    level.confidence >= 45 ? "text-warning" : "text-muted";

  return (
    <div className={`bg-card border-t-4 ${accentClass.split(" ")[0]} border border-border p-6`}>
      <div className="text-sm text-muted tracking-widest mb-2 font-semibold">{title}</div>

      <div className={`text-5xl font-bold mb-1 ${accentClass.split(" ")[1]}`}>
        ${level.strike.toFixed(2)}
      </div>
      <div className="text-sm text-subtle mb-4">
        {sign}{pctFromSpot}% vs spot
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-3 mb-1">
        <div className={`text-3xl font-bold ${confColor}`}>{level.confidence}%</div>
        <div className={`text-xs tracking-widest font-bold ${confColor}`}>{confidenceLabel}</div>
      </div>
      <div className="w-full h-1.5 bg-surface border border-border mb-4">
        <div
          className={`h-full transition-all ${isSupport ? "bg-accent" : "bg-danger"}`}
          style={{ width: `${level.confidence}%` }}
        />
      </div>

      {/* 3 sub-scores */}
      <div className="space-y-2.5">
        <SubScore label="GEX WALL" value={level.gexScore} />
        <SubScore
          label="MAX PAIN"
          value={level.maxPainScore}
          note={`±${level.maxPainDistancePct}% de MP`}
        />
        <SubScore
          label="NOTIONAL OI"
          value={level.notionalOIScore}
          note={`${fmtNotional(level.notionalOI)} · ${level.expirationsWithHighOI} exp`}
        />
      </div>
    </div>
  );
}

// ─── Signal row ───────────────────────────────────────────────────────────────
function SignalRow({ signal }: { signal: SignalComponent }) {
  const isPos = signal.normalizedValue >= 0;
  const pct = Math.min(Math.abs(signal.normalizedValue) * 50, 50);
  const contribPts = Math.round(signal.contribution * 100);

  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3 mb-1.5">
        <div className="text-xs font-bold tracking-wider text-gray-700 w-36 shrink-0">
          {signal.name}
        </div>
        <div className="flex-1 relative h-4 bg-surface border border-border">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border z-10" />
          <div
            className={`absolute top-0.5 bottom-0.5 transition-all ${isPos ? "bg-accent" : "bg-danger"}`}
            style={{
              left: isPos ? "50%" : `${50 - pct}%`,
              width: `${pct}%`,
            }}
          />
        </div>
        <div className="text-xs text-muted w-10 text-right shrink-0">
          {Math.round(signal.weight * 100)}%
        </div>
        <div
          className={`text-xs font-bold w-10 text-right shrink-0 ${contribPts >= 0 ? "text-accent" : "text-danger"}`}
        >
          {contribPts >= 0 ? "+" : ""}{contribPts}
        </div>
      </div>
      <div className="text-xs text-muted ml-36 pl-3 leading-relaxed">{signal.label}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Metodologia5() {
  const [ticker, setTicker] = useState("SPY");
  const [data, setData] = useState<Analysis5Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAnalysis = useCallback(async (t: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analysis5?ticker=${t}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  async function analyze() {
    if (!ticker.trim()) return;
    await fetchAnalysis(ticker);
  }

  const verdictColor =
    data?.verdict === "ALCISTA" ? "text-accent" :
    data?.verdict === "BAJISTA" ? "text-danger" :
    "text-warning";

  const verdictBorderColor =
    data?.verdict === "ALCISTA" ? "border-accent" :
    data?.verdict === "BAJISTA" ? "border-danger" :
    "border-warning";

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
        <button
          onClick={analyze}
          disabled={loading}
          className="bg-accent text-white px-6 py-2 text-base font-bold tracking-widest hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          {loading ? "..." : "ANALYZE"}
        </button>
        {data && (
          <span className="text-xs text-muted">
            {data.expirationsAnalyzed} vencimientos · Max Pain ${data.maxPain.toFixed(2)} · {data.expirationUsed}
          </span>
        )}
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
          <div className="w-20 h-20 border-2 border-border flex items-center justify-center text-4xl">◉</div>
          <p className="text-base tracking-widest">SEÑAL DIRECCIONAL CONSOLIDADA</p>
          <p className="text-sm opacity-60">GEX Wall · Max Pain · Notional OI · Score Unificado</p>
          <p className="text-sm opacity-40">SPY · QQQ · NVDA · AAPL · TSLA · MSFT · AMZN · GOOGL</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-base text-muted tracking-widest">CONSOLIDANDO SEÑALES...</p>
          </div>
        </div>
      )}

      {/* Dashboard */}
      {data && !loading && (
        <main className="p-6 space-y-6">

          {/* ── VERDICT HERO ─────────────────────────────────────────────────── */}
          <div className={`bg-card border-2 ${verdictBorderColor} p-8`}>
            <div className="flex flex-wrap items-center gap-8 mb-6">
              <div>
                <div className="text-xs text-muted tracking-widest mb-2">SEÑAL CONSOLIDADA</div>
                <div className={`text-7xl font-black tracking-widest ${verdictColor}`}>
                  {data.verdict}
                </div>
              </div>
              <div className="border-l-2 border-border pl-8">
                <div className="text-xs text-muted tracking-widest mb-1">PROBABILIDAD</div>
                <div className={`text-5xl font-bold ${verdictColor}`}>{data.probability}%</div>
              </div>
              <div className="border-l-2 border-border pl-8">
                <div className="text-xs text-muted tracking-widest mb-1">SCORE</div>
                <div className={`text-5xl font-bold ${data.score >= 0 ? "text-accent" : "text-danger"}`}>
                  {data.score >= 0 ? "+" : ""}{data.score}
                </div>
              </div>
              <div className="border-l-2 border-border pl-8">
                <div className="text-xs text-muted tracking-widest mb-1">SPOT</div>
                <div className="text-3xl font-bold text-gray-900">${data.spot.toFixed(2)}</div>
              </div>
              <div className="border-l-2 border-border pl-8">
                <div className="text-xs text-muted tracking-widest mb-1">MAX PAIN</div>
                <div className="text-3xl font-bold text-subtle">${data.maxPain.toFixed(2)}</div>
              </div>
              <div className="border-l-2 border-border pl-8">
                <div className="text-xs text-muted tracking-widest mb-1">TICKER</div>
                <div className="text-3xl font-bold text-accent">{data.ticker}</div>
              </div>
            </div>

            {/* Score bar */}
            <div>
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>−100 · BAJISTA</span>
                <span>NEUTRAL</span>
                <span>ALCISTA · +100</span>
              </div>
              <ScoreBar value={data.score} />
            </div>
          </div>

          {/* ── SOLID S/R LEVELS ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <SRCard level={data.support} spot={data.spot} type="support" />
            <SRCard level={data.resistance} spot={data.spot} type="resistance" />
          </div>

          {/* ── SIGNAL BREAKDOWN ─────────────────────────────────────────────── */}
          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-1 font-semibold">
              DESGLOSE DE SEÑALES — 5 DIMENSIONES
            </div>
            <div className="text-xs text-muted mb-1">
              Cada señal contribuye al score final con su peso relativo
            </div>
            <div className="flex justify-between text-xs text-muted mb-4 border-b border-border pb-2 mt-3">
              <span className="w-36">SEÑAL</span>
              <span className="flex-1 text-center">BAJISTA ← · → ALCISTA</span>
              <span className="w-10 text-right">PESO</span>
              <span className="w-10 text-right">+/−</span>
            </div>
            {data.signals.map((s, i) => (
              <SignalRow key={i} signal={s} />
            ))}
          </div>

          {/* ── SCORED STRIKES CHART ─────────────────────────────────────────── */}
          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-1 font-semibold">
              CALIDAD DE NIVELES POR STRIKE — GEX WALL + MAX PAIN + NOTIONAL OI
            </div>
            <div className="text-xs text-muted mb-5">
              Verde = soporte institucional · Rojo = resistencia institucional · Gris = sin posicionamiento claro
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.scoredStrikes}
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
                <XAxis
                  dataKey="strike"
                  tick={{ fill: "#555", fontSize: 10 }}
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis
                  tick={{ fill: "#555", fontSize: 10 }}
                  domain={[0, 1]}
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  width={45}
                />
                <Tooltip
                  contentStyle={{ background: "#f9f9f9", border: "1px solid #e0e0e0", fontSize: 12 }}
                  formatter={(v: number, _name: string, props: any) => {
                    const entry: ScoredStrike = props.payload;
                    const tipo = entry.isSupport ? "Soporte" : entry.isResistance ? "Resistencia" : "Neutral";
                    return [
                      `${Math.round(v * 100)}% · ${fmtNotional(entry.notionalOI)}`,
                      tipo,
                    ];
                  }}
                  labelFormatter={(l) => `Strike: $${l}`}
                />
                <ReferenceLine
                  x={data.spot}
                  stroke="#000"
                  strokeWidth={2}
                  label={{ value: "SPOT", fill: "#000", fontSize: 9 }}
                />
                {data.support && (
                  <ReferenceLine
                    x={data.support.strike}
                    stroke="#00a854"
                    strokeDasharray="4 4"
                    label={{ value: "SUP", fill: "#00a854", fontSize: 9 }}
                  />
                )}
                {data.resistance && (
                  <ReferenceLine
                    x={data.resistance.strike}
                    stroke="#e53935"
                    strokeDasharray="4 4"
                    label={{ value: "RES", fill: "#e53935", fontSize: 9 }}
                  />
                )}
                {data.maxPain > 0 && (
                  <ReferenceLine
                    x={data.maxPain}
                    stroke="#f9a825"
                    strokeDasharray="2 4"
                    label={{ value: "MP", fill: "#f9a825", fontSize: 9 }}
                  />
                )}
                <Bar dataKey="totalScore" radius={[2, 2, 0, 0]}>
                  {data.scoredStrikes.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.isSupport ? "#00a854" :
                        entry.isResistance ? "#e53935" :
                        "#cccccc"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex gap-6 mt-4 text-xs text-muted">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-accent" />
                <span>GEX+ bajo spot = soporte</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-danger" />
                <span>GEX− sobre spot = resistencia</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3" style={{ background: "#f9a825" }} />
                <span>MP = Max Pain</span>
              </div>
            </div>
          </div>

        </main>
      )}
    </div>
  );
}
