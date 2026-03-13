"use client";

import { useState, useCallback } from "react";
import type { Heatmap2DData } from "@/app/api/heatmap2d/route";
import GexHeatmap2D from "@/components/GexHeatmap2D";

export default function Metodologia4() {
  const [ticker, setTicker]           = useState("SPY");
  const [upTo, setUpTo]               = useState("");
  const [allExpirations, setAllExpirations] = useState<string[]>([]);
  const [data, setData]               = useState<Heatmap2DData | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const fetchHeatmap = useCallback(async (t: string, exp: string) => {
    setLoading(true);
    setError("");
    try {
      const url = exp
        ? `/api/heatmap2d?ticker=${t}&upTo=${exp}`
        : `/api/heatmap2d?ticker=${t}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      setData(json);
      if (json.allExpirations?.length > 0) setAllExpirations(json.allExpirations);
      if (!exp && json.allExpirations?.length > 0) setUpTo(json.allExpirations[7] ?? json.allExpirations.at(-1));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  async function analyze() {
    if (!ticker.trim()) return;
    await fetchHeatmap(ticker, upTo);
  }

  async function handleExpirationChange(exp: string) {
    setUpTo(exp);
    await fetchHeatmap(ticker, exp);
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
            value={upTo}
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
                {dates.map((exp) => {
                  const d   = new Date(exp + "T12:00:00");
                  const dow = d.getDay();
                  const day = d.getDate();
                  const mon = d.getMonth();
                  const isThirdFri = dow === 5 && day >= 15 && day <= 21;
                  const isQuart    = isThirdFri && [2, 5, 8, 11].includes(mon);
                  const isMon      = isThirdFri && !isQuart;
                  const suffix = isQuart ? " ★ TRIMESTRAL" : isMon ? " · MENSUAL" : "";
                  return (
                    <option key={exp} value={exp}>{exp}{suffix}</option>
                  );
                })}
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

        {data && (
          <span className="text-xs text-muted">
            {data.expirations.length} vencimientos · {data.strikes.length} strikes · {data.cells.length} celdas
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-4 border border-danger text-danger text-sm">✕ {error}</div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4 text-muted">
          <div className="w-20 h-20 border-2 border-border flex items-center justify-center text-4xl">⊞</div>
          <p className="text-base tracking-widest">MAPA DE CALOR GEX 2D</p>
          <p className="text-sm opacity-60">Eje Y = strikes · Eje X = vencimientos hasta fecha seleccionada</p>
          <p className="text-sm opacity-40">Verde = soporte (GEX+) · Rojo = resistencia (GEX−) · Barra azul = OI</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-base text-muted tracking-widest">CARGANDO VENCIMIENTOS...</p>
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
              <div className="text-sm text-muted tracking-widest mb-1">SOPORTE</div>
              <div className="text-3xl font-bold text-accent">${data.support.toFixed(2)}</div>
            </div>
            <div className="border-l-2 border-border pl-8">
              <div className="text-sm text-muted tracking-widest mb-1">RESISTENCIA</div>
              <div className="text-3xl font-bold text-danger">${data.resistance.toFixed(2)}</div>
            </div>
            <div className="border-l-2 border-border pl-8">
              <div className="text-sm text-muted tracking-widest mb-1">HASTA</div>
              <div className="text-2xl font-bold text-subtle">{data.expirations.at(-1)}</div>
            </div>
          </div>

          {/* 2D Heatmap */}
          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-1 font-semibold">
              MAPA DE CALOR GEX — STRIKE × VENCIMIENTO
            </div>
            <div className="text-xs text-muted mb-5">
              Color = GEX por celda · Intensidad = magnitud · Barra azul = Open Interest
            </div>
            <GexHeatmap2D data={data} />
          </div>

        </main>
      )}
    </div>
  );
}
