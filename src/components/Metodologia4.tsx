"use client";

import { useState, useCallback, useEffect } from "react";
import type { Heatmap2DData } from "@/app/api/heatmap2d/route";
import GexHeatmap2D from "@/components/GexHeatmap2D";
import SkewPanel from "@/components/SkewPanel";

export default function Metodologia4({
  ticker,
  expiration,
  analyzeKey,
}: {
  ticker: string;
  expiration: string;
  analyzeKey: number;
}) {
  const [data, setData] = useState<Heatmap2DData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchHeatmap = useCallback(async (t: string, exp: string) => {
    setLoading(true);
    setError("");
    try {
      const url = exp
        ? `/api/heatmap2d?ticker=${t}&upTo=${exp}`
        : `/api/heatmap2d?ticker=${t}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (analyzeKey > 0 && ticker) {
      fetchHeatmap(ticker, expiration);
    }
  }, [analyzeKey]);

  return (
    <div>
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
              <div className="text-sm text-muted tracking-widest mb-1">VENCIMIENTOS</div>
              <div className="text-2xl font-bold text-subtle">{data.expirations.length}</div>
            </div>
          </div>

          {/* 2D Heatmap */}
          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-1 font-semibold">
              MAPA DE CALOR GEX — STRIKE × VENCIMIENTO
            </div>
            <div className="text-xs text-muted mb-5">
              Color = GEX · Barra azul = OI · Barra naranja/azul = Skew IV
            </div>
            <GexHeatmap2D data={data} />
          </div>

          {/* Skew Panel */}
          <div className="bg-card border border-border p-6">
            <div className="text-sm text-muted tracking-widest mb-1 font-semibold">
              ANÁLISIS DE SKEW — PUTS / CALLS
            </div>
            <div className="text-xs text-muted mb-5">
              Dónde están pagando más por protección · Estructura de plazos del 25Δ skew
            </div>
            <SkewPanel data={data} />
          </div>

        </main>
      )}
    </div>
  );
}
