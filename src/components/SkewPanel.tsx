"use client";

import type { Heatmap2DData } from "@/app/api/heatmap2d/route";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Cell, ResponsiveContainer,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortExp(exp: string): string {
  const d = new Date(exp + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function pct(v: number) {
  return `${(v * 100).toFixed(2)}%`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SkewPanel({ data }: { data: Heatmap2DData }) {
  const { cells, expirations, skew25d, spot, support, resistance } = data;

  // ── 1. Per-strike skew (avg across all loaded expirations) ──────────────────
  const strikeMap = new Map<number, { sum: number; count: number }>();
  for (const c of cells) {
    if (c.skew === 0) continue;
    const prev = strikeMap.get(c.strike) ?? { sum: 0, count: 0 };
    strikeMap.set(c.strike, { sum: prev.sum + c.skew, count: prev.count + 1 });
  }

  const strikeSkew = Array.from(strikeMap.entries())
    .map(([strike, { sum, count }]) => ({
      strike,
      skew: sum / count,
    }))
    .sort((a, b) => a.strike - b.strike);

  // ── 2. 25Δ skew term structure across expirations ───────────────────────────
  const termStructure = expirations.map((exp) => ({
    exp: shortExp(exp),
    skew25d: skew25d?.[exp] ?? 0,
  }));

  // ── 3. Top 5 strikes with strongest put skew (most negative) ────────────────
  const topPutSkew = [...strikeSkew]
    .sort((a, b) => a.skew - b.skew)
    .slice(0, 5);

  // ── 4. Top 5 strikes with strongest call skew (most positive / least negative) ─
  const topCallSkew = [...strikeSkew]
    .sort((a, b) => b.skew - a.skew)
    .slice(0, 5);

  return (
    <div className="space-y-6">

      {/* ── Tabla resumen top skew ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Puts más caros */}
        <div className="border border-border bg-card p-4">
          <div className="text-xs font-bold tracking-widest text-muted mb-3">
            PUTS MÁS CAROS — COBERTURA BAJISTA ACTIVA
          </div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted border-b border-border">
                <th className="text-left pb-1">STRIKE</th>
                <th className="text-right pb-1">SKEW (IV put − call)</th>
                <th className="text-right pb-1">NIVEL</th>
              </tr>
            </thead>
            <tbody>
              {topPutSkew.map((row) => (
                <tr key={row.strike} className="border-b border-border last:border-0">
                  <td className="py-1 font-bold text-gray-800">${row.strike}</td>
                  <td className="py-1 text-right font-bold" style={{ color: "#e65100" }}>
                    {pct(row.skew)}
                  </td>
                  <td className="py-1 text-right text-muted">
                    {row.strike === support ? "SUP ▼" : row.strike === resistance ? "RES ▲" : Math.abs(row.strike - spot) < 0.5 ? "SPOT" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[10px] text-muted mt-3 leading-relaxed">
            Strikes donde los institucionales pagan más por puts. Mayor skew negativo = mayor demanda de cobertura = nivel más relevante para soporte.
          </div>
        </div>

        {/* Calls más caros */}
        <div className="border border-border bg-card p-4">
          <div className="text-xs font-bold tracking-widest text-muted mb-3">
            CALLS MÁS CAROS — SESGO ALCISTA / RUPTURA
          </div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted border-b border-border">
                <th className="text-left pb-1">STRIKE</th>
                <th className="text-right pb-1">SKEW (IV call − put)</th>
                <th className="text-right pb-1">NIVEL</th>
              </tr>
            </thead>
            <tbody>
              {topCallSkew.map((row) => (
                <tr key={row.strike} className="border-b border-border last:border-0">
                  <td className="py-1 font-bold text-gray-800">${row.strike}</td>
                  <td className="py-1 text-right font-bold" style={{ color: "#1565c0" }}>
                    +{pct(Math.abs(row.skew))}
                  </td>
                  <td className="py-1 text-right text-muted">
                    {row.strike === support ? "SUP ▼" : row.strike === resistance ? "RES ▲" : Math.abs(row.strike - spot) < 0.5 ? "SPOT" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[10px] text-muted mt-3 leading-relaxed">
            Strikes donde los calls son más caros que los puts. Inusual — indica demanda de exposición alcista o expectativa de ruptura en esa zona.
          </div>
        </div>
      </div>

      {/* ── Gráfico 1: Skew por strike ── */}
      <div className="border border-border bg-card p-5">
        <div className="text-xs font-bold tracking-widest text-muted mb-1">
          SKEW POR STRIKE — IV PUT − IV CALL (PROMEDIO ENTRE VENCIMIENTOS)
        </div>
        <div className="text-[11px] text-muted mb-4">
          Barras naranjas = puts más caros que calls (cobertura bajista) · Barras azules = calls más caros (sesgo alcista)
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={strikeSkew} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
            <XAxis
              dataKey="strike"
              tick={{ fill: "#555", fontSize: 9 }}
              tickFormatter={(v) => `$${v}`}
            />
            <YAxis
              tick={{ fill: "#555", fontSize: 9 }}
              tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
              width={52}
            />
            <Tooltip
              contentStyle={{ background: "#f9f9f9", border: "1px solid #e0e0e0", fontSize: 11 }}
              formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, "Skew IV put − call"]}
              labelFormatter={(l) => `Strike: $${l}`}
            />
            <ReferenceLine y={0} stroke="#bbb" />
            <ReferenceLine
              x={spot}
              stroke="#000"
              strokeWidth={2}
              label={{ value: "SPOT", fill: "#000", fontSize: 8 }}
            />
            <ReferenceLine
              x={support}
              stroke="#00a854"
              strokeDasharray="4 4"
              label={{ value: "SUP", fill: "#00a854", fontSize: 8 }}
            />
            <ReferenceLine
              x={resistance}
              stroke="#e53935"
              strokeDasharray="4 4"
              label={{ value: "RES", fill: "#e53935", fontSize: 8 }}
            />
            <Bar dataKey="skew" radius={[2, 2, 0, 0]}>
              {strikeSkew.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.skew < 0 ? "#e65100" : "#1565c0"}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Gráfico 2: Term structure 25Δ skew ── */}
      <div className="border border-border bg-card p-5">
        <div className="text-xs font-bold tracking-widest text-muted mb-1">
          ESTRUCTURA DE PLAZOS — 25Δ SKEW POR VENCIMIENTO
        </div>
        <div className="text-[11px] text-muted mb-4">
          Más negativo = mayor miedo institucional hacia esa fecha · Picos indican vencimientos de alto riesgo percibido
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={termStructure} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
            <XAxis dataKey="exp" tick={{ fill: "#555", fontSize: 9 }} />
            <YAxis
              tick={{ fill: "#555", fontSize: 9 }}
              tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
              width={52}
            />
            <Tooltip
              contentStyle={{ background: "#f9f9f9", border: "1px solid #e0e0e0", fontSize: 11 }}
              formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, "25Δ Skew"]}
            />
            <ReferenceLine y={0} stroke="#bbb" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="skew25d"
              stroke="#e65100"
              strokeWidth={2}
              dot={{ fill: "#e65100", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
