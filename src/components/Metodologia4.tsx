"use client";

import { useState, useCallback } from "react";
import type { Analysis3Result, AggStrikeData } from "@/types";

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

// ─── Proximity colour helpers ────────────────────────────────────────────────

function proximityColor(strike: number, spot: number): string {
  const distPct = Math.abs(strike - spot) / spot; // 0 → 0.15
  const intensity = Math.max(0, 1 - distPct / 0.15); // 1 = at spot, 0 = 15% away
  const alpha = 0.15 + intensity * 0.75; // 0.15 → 0.90

  if (Math.abs(strike - spot) < 0.5) return "rgba(245,166,35,0.95)"; // spot = gold
  if (strike > spot) return `rgba(229,57,53,${alpha.toFixed(2)})`; // above = red
  return `rgba(0,168,84,${alpha.toFixed(2)})`; // below = green
}

function proximityBorderColor(strike: number, spot: number): string {
  if (Math.abs(strike - spot) < 0.5) return "#f5a623";
  if (strike > spot) return "#e53935";
  return "#00a854";
}

// ─── Proximity distance label ────────────────────────────────────────────────

function distLabel(level: number, spot: number) {
  const pct = ((level - spot) / spot) * 100;
  return pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`;
}

function alertLevel(level: number, spot: number): "DANGER" | "ALERT" | "WATCH" | "SAFE" {
  const pct = Math.abs((level - spot) / spot) * 100;
  if (pct < 0.5) return "DANGER";
  if (pct < 1.5) return "ALERT";
  if (pct < 3) return "WATCH";
  return "SAFE";
}

const ALERT_COLORS: Record<string, string> = {
  DANGER: "text-danger border-danger bg-red-50",
  ALERT:  "text-orange-600 border-orange-400 bg-orange-50",
  WATCH:  "text-warning border-yellow-400 bg-yellow-50",
  SAFE:   "text-accent border-accent bg-green-50",
};

// ─── ProximityHeatmap ────────────────────────────────────────────────────────

function ProximityHeatmap({
  strikes,
  spot,
  support,
  resistance,
}: {
  strikes: AggStrikeData[];
  spot: number;
  support: number;
  resistance: number;
}) {
  const sorted = [...strikes].sort((a, b) => b.strike - a.strike);
  const maxOI = Math.max(...strikes.map((s) => s.totalOI), 1);

  return (
    <div className="space-y-[3px]">
      {/* Legend */}
      <div className="flex items-center gap-6 mb-3 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded" style={{ background: "rgba(229,57,53,0.85)" }} />
          Acercándose a resistencia
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded" style={{ background: "rgba(245,166,35,0.95)" }} />
          Spot actual
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded" style={{ background: "rgba(0,168,84,0.85)" }} />
          Acercándose a soporte
        </span>
        <span className="flex items-center gap-1 ml-auto">
          Ancho de barra = Open Interest relativo
        </span>
      </div>

      {sorted.map((s) => {
        const isSupport    = s.strike === support;
        const isResistance = s.strike === resistance;
        const isNearSpot   = Math.abs(s.strike - spot) < 0.5;
        const barWidth     = Math.max(4, (s.totalOI / maxOI) * 100);
        const distPct      = Math.abs(s.strike - spot) / spot * 100;
        const bg           = proximityColor(s.strike, spot);
        const border       = isSupport || isResistance || isNearSpot
          ? proximityBorderColor(s.strike, spot)
          : "transparent";

        return (
          <div key={s.strike} className="flex items-center gap-2 group">
            {/* Strike label */}
            <div className="w-16 text-right text-xs font-mono text-gray-500 shrink-0">
              ${s.strike}
            </div>

            {/* Heat bar */}
            <div className="flex-1 h-7 relative">
              <div
                className="h-full rounded transition-all duration-300"
                style={{
                  width: `${barWidth}%`,
                  background: bg,
                  borderLeft: `3px solid ${border}`,
                  minWidth: "6px",
                }}
              />
              {/* Key level badges */}
              {isResistance && (
                <span className="absolute left-[calc(${barWidth}%+6px)] top-1 text-[9px] font-bold text-danger tracking-widest">
                  ▲ RESISTENCIA
                </span>
              )}
              {isSupport && (
                <span className="absolute left-[calc(${barWidth}%+6px)] top-1 text-[9px] font-bold text-accent tracking-widest">
                  ▼ SOPORTE
                </span>
              )}
              {isNearSpot && (
                <span className="absolute right-2 top-1 text-[9px] font-bold text-yellow-600 tracking-widest">
                  ◆ SPOT
                </span>
              )}
            </div>

            {/* Distance */}
            <div
              className="w-14 text-right text-xs font-mono shrink-0"
              style={{ color: s.strike > spot ? "#e53935" : "#00a854" }}
            >
              {distPct.toFixed(2)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ProximityGauge ──────────────────────────────────────────────────────────

function ProximityGauge({
  label,
  level,
  spot,
  color,
}: {
  label: string;
  level: number;
  spot: number;
  color: string;
}) {
  const pct     = Math.abs((level - spot) / spot) * 100;
  const status  = alertLevel(level, spot);
  const filled  = Math.max(2, Math.min(100, 100 - pct * 6.67)); // 15% away → 0%, 0% → 100%

  return (
    <div className={`border rounded p-4 ${ALERT_COLORS[status]}`}>
      <div className="text-xs tracking-widest font-bold mb-1">{label}</div>
      <div className="text-2xl font-bold mb-1">${level.toFixed(2)}</div>
      <div className="text-sm font-semibold mb-2">{distLabel(level, spot)} vs spot</div>
      <div className="w-full h-2 bg-white bg-opacity-60 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${filled}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-[10px] font-bold tracking-widest mt-2">{status}</div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Metodologia4() {
  const [ticker, setTicker]               = useState("SPY");
  const [expiration, setExpiration]       = useState("");
  const [allExpirations, setAllExpirations] = useState<string[]>([]);
  const [data, setData]                   = useState<Analysis3Result | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");

  const fetchAnalysis = useCallback(async (t: string, exp: string) => {
    setLoading(true);
    setError("");
    try {
      const url = exp
        ? `/api/analysis3?ticker=${t}&expiration=${exp}`
        : `/api/analysis3?ticker=${t}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      setData(json);
      setExpiration(json.expiration);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  async function analyze() {
    if (!ticker.trim()) return;
    try {
      const expRes  = await fetch(`/api/expirations?ticker=${ticker}`);
      const expJson = await expRes.json();
      if (expRes.ok && expJson.expirations?.length > 0) {
        setAllExpirations(expJson.expirations);
        const first = expiration || expJson.expirations[0];
        setExpiration(first);
        await fetchAnalysis(ticker, first);
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
                const label = new Date(exp + "T12:00:00").toLocaleString("en-US", {
                  month: "long", year: "numeric",
                });
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
          <p className="text-base tracking-widest">MAPA DE CALOR — PROXIMIDAD A NIVELES S/R</p>
          <p className="text-sm opacity-60">Verde = acercándose al soporte · Rojo = acercándose a la resistencia</p>
          <p className="text-sm opacity-40">SPY · QQQ · NVDA · AAPL · TSLA · MSFT · AMZN · GOOGL</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-base text-muted tracking-widest">CALCULANDO PROXIMIDAD...</p>
          </div>
        </div>
      )}

      {/* Dashboard */}
      {data && !loading && (
        <main className="p-6 space-y-6">

          {/* Header */}
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

          {/* Proximity gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <ProximityGauge
              label="SOPORTE"
              level={data.support}
              spot={data.spot}
              color="#00a854"
            />
            <ProximityGauge
              label="RESISTENCIA"
              level={data.resistance}
              spot={data.spot}
              color="#e53935"
            />
            <div className="border border-border rounded p-4 bg-card">
              <div className="text-xs tracking-widest font-bold text-muted mb-1">DISTANCIA AL SOPORTE</div>
              <div className="text-2xl font-bold text-accent">
                {Math.abs(((data.support - data.spot) / data.spot) * 100).toFixed(2)}%
              </div>
              <div className="text-xs text-muted mt-2">
                {data.spot - data.support < 0
                  ? "Spot por encima del soporte"
                  : "Spot por debajo del soporte — nivel roto"}
              </div>
            </div>
            <div className="border border-border rounded p-4 bg-card">
              <div className="text-xs tracking-widest font-bold text-muted mb-1">DISTANCIA A RESISTENCIA</div>
              <div className="text-2xl font-bold text-danger">
                {Math.abs(((data.resistance - data.spot) / data.spot) * 100).toFixed(2)}%
              </div>
              <div className="text-xs text-muted mt-2">
                {data.resistance - data.spot > 0
                  ? "Spot por debajo de la resistencia"
                  : "Spot por encima — nivel superado"}
              </div>
            </div>
          </div>

          {/* Heatmap */}
          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-2 font-semibold">
              MAPA DE CALOR — PROXIMIDAD DEL SPOT A CADA STRIKE
            </div>
            <div className="text-xs text-muted mb-5">
              Intensidad del color = cercanía al precio actual · Ancho de barra = Open Interest acumulado
            </div>
            <ProximityHeatmap
              strikes={data.filteredStrikes}
              spot={data.spot}
              support={data.support}
              resistance={data.resistance}
            />
          </div>

        </main>
      )}
    </div>
  );
}
