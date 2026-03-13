"use client";

import { useState } from "react";
import type { Heatmap2DData } from "@/app/api/heatmap2d/route";
import GexHeatmap2D from "@/components/GexHeatmap2D";

export default function Metodologia4() {
  const [ticker, setTicker] = useState("SPY");
  const [data, setData]     = useState<Heatmap2DData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  async function analyze() {
    if (!ticker.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/heatmap2d?ticker=${ticker}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
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
          <p className="text-sm opacity-60">Eje Y = strikes · Eje X = vencimientos</p>
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
