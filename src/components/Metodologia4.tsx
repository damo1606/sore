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

// ─── Cell colour helpers for the 2-D grid ────────────────────────────────────

function cellGex(v: number, maxAbs: number) {
  const t = Math.min(Math.abs(v) / maxAbs, 1);
  const a = (0.12 + t * 0.78).toFixed(2);
  return v >= 0 ? `rgba(0,168,84,${a})` : `rgba(229,57,53,${a})`;
}
function cellOI(v: number, maxOI: number) {
  const t = Math.min(v / maxOI, 1);
  const a = (0.08 + t * 0.82).toFixed(2);
  return `rgba(21,101,192,${a})`;
}
function cellPcr(v: number) {
  const dev = Math.min(Math.abs(v - 1) / 1.5, 1);
  const a   = (0.12 + dev * 0.78).toFixed(2);
  return v > 1 ? `rgba(0,168,84,${a})` : `rgba(229,57,53,${a})`;
}
function cellConf(v: number, maxAbs: number) {
  const t = Math.min(Math.abs(v) / maxAbs, 1);
  const a = (0.12 + t * 0.78).toFixed(2);
  return v >= 0 ? `rgba(0,168,84,${a})` : `rgba(229,57,53,${a})`;
}
function textOnDark(alpha: number) {
  return alpha > 0.5 ? "#fff" : "#374151";
}

// ─── ProximityHeatmap — 2-D grid ─────────────────────────────────────────────

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
  const sorted   = [...strikes].sort((a, b) => b.strike - a.strike);
  const maxOI    = Math.max(...strikes.map((s) => s.totalOI), 1);
  const maxGexAb = Math.max(...strikes.map((s) => Math.abs(s.totalGEX)), 1);
  const maxConfAb = Math.max(...strikes.map((s) => Math.abs(s.confluenceScore)), 1);

  const COL = "flex items-center justify-center text-[10px] font-mono rounded h-10 transition-all";
  const HDR = "flex items-center justify-center text-[9px] font-bold tracking-widest text-muted h-7";

  return (
    <div className="overflow-x-auto">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 mb-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded" style={{ background: "rgba(229,57,53,0.82)" }} />
          Acercándose a resistencia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-yellow-400" />
          Spot actual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded" style={{ background: "rgba(0,168,84,0.82)" }} />
          Acercándose a soporte
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          <span className="inline-block w-4 h-4 rounded" style={{ background: "rgba(21,101,192,0.72)" }} />
          Open Interest
        </span>
        <span className="text-[10px]">Mayor intensidad = mayor cercanía o magnitud</span>
      </div>

      {/* Column headers */}
      <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: "72px 1fr 64px 64px 64px 64px 56px" }}>
        <div className={HDR}>STRIKE</div>
        <div className={HDR}>PROXIMIDAD AL SPOT</div>
        <div className={HDR}>GEX</div>
        <div className={HDR}>OI</div>
        <div className={HDR}>PCR</div>
        <div className={HDR}>CONF</div>
        <div className={HDR}>±%</div>
      </div>

      {/* Rows */}
      <div className="space-y-[3px]">
        {sorted.map((s) => {
          const isSupport    = s.strike === support;
          const isResistance = s.strike === resistance;
          const isSpot       = Math.abs(s.strike - spot) < 0.5;
          const distPct      = Math.abs(s.strike - spot) / spot * 100;

          // Proximity bar
          const proxIntensity = Math.max(0, 1 - distPct / 15);
          const proxAlpha     = 0.1 + proxIntensity * 0.85;
          const proxBg        = isSpot
            ? "rgba(245,166,35,0.95)"
            : s.strike > spot
            ? `rgba(229,57,53,${proxAlpha.toFixed(2)})`
            : `rgba(0,168,84,${proxAlpha.toFixed(2)})`;
          const proxBarW = Math.max(4, proxIntensity * 100);

          // Cell backgrounds
          const bgGex  = cellGex(s.totalGEX, maxGexAb);
          const bgOI   = cellOI(s.totalOI, maxOI);
          const bgPcr  = cellPcr(s.weightedPCR);
          const bgConf = cellConf(s.confluenceScore, maxConfAb);

          // Row border for key levels
          const rowBorder = isResistance
            ? "2px solid #e53935"
            : isSupport
            ? "2px solid #00a854"
            : isSpot
            ? "2px solid #f5a623"
            : "1px solid #f0f0f0";

          return (
            <div
              key={s.strike}
              className="grid gap-1 items-stretch"
              style={{
                gridTemplateColumns: "72px 1fr 64px 64px 64px 64px 56px",
                border: rowBorder,
                borderRadius: "4px",
              }}
            >
              {/* Strike */}
              <div className="flex items-center justify-end pr-2 h-10">
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-gray-700">${s.strike}</div>
                  {isResistance && <div className="text-[8px] font-bold text-danger leading-none">RES ▲</div>}
                  {isSupport    && <div className="text-[8px] font-bold text-accent leading-none">SUP ▼</div>}
                  {isSpot       && <div className="text-[8px] font-bold text-yellow-600 leading-none">SPOT ◆</div>}
                </div>
              </div>

              {/* Proximity bar */}
              <div className="flex items-center px-1 h-10">
                <div className="w-full h-6 bg-gray-100 rounded overflow-hidden relative">
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{ width: `${proxBarW}%`, background: proxBg }}
                  />
                  <span
                    className="absolute inset-0 flex items-center px-2 text-[10px] font-mono"
                    style={{ color: proxIntensity > 0.5 ? "#fff" : "#374151" }}
                  >
                    {distPct < 0.1 ? "← SPOT →" : `${distPct.toFixed(2)}% del spot`}
                  </span>
                </div>
              </div>

              {/* GEX cell */}
              <div
                className={COL}
                style={{ background: bgGex, color: textOnDark(0.12 + Math.min(Math.abs(s.totalGEX)/maxGexAb,1)*0.78) }}
              >
                {(s.totalGEX / 1e9).toFixed(1)}B
              </div>

              {/* OI cell */}
              <div
                className={COL}
                style={{ background: bgOI, color: textOnDark(0.08 + Math.min(s.totalOI/maxOI,1)*0.82) }}
              >
                {(s.totalOI / 1e3).toFixed(0)}K
              </div>

              {/* PCR cell */}
              <div
                className={COL}
                style={{ background: bgPcr, color: textOnDark(0.12 + Math.min(Math.abs(s.weightedPCR-1)/1.5,1)*0.78) }}
              >
                {s.weightedPCR.toFixed(2)}
              </div>

              {/* Confluence cell */}
              <div
                className={COL}
                style={{ background: bgConf, color: textOnDark(0.12 + Math.min(Math.abs(s.confluenceScore)/maxConfAb,1)*0.78) }}
              >
                {s.confluenceScore.toFixed(2)}
              </div>

              {/* Distance */}
              <div
                className="flex items-center justify-center text-[10px] font-mono font-bold h-10"
                style={{ color: isSpot ? "#f5a623" : s.strike > spot ? "#e53935" : "#00a854" }}
              >
                {s.strike > spot ? "+" : s.strike < spot ? "-" : ""}{distPct.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
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
