"use client";

import { useState } from "react";

interface LevelResult {
  level: number;
  type: "support" | "resistance";
  respected: boolean;
  touched: boolean;
  daysChecked: number;
}

interface SnapshotResult {
  snapshot_id: number;
  date: string;
  spot: number;
  regime: string;
  score: number;
  levels: LevelResult[];
}

interface ModuleStat {
  module: string;
  total: number;
  respected: number;
  accuracy: number;
}

interface BacktestData {
  ticker: string;
  snapshots: SnapshotResult[];
  moduleStats: ModuleStat[];
}

export default function BacktestPage() {
  const [ticker, setTicker] = useState("");
  const [data, setData] = useState<BacktestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runBacktest() {
    if (!ticker) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res  = await fetch(`/api/backtest?ticker=${ticker.toUpperCase()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  const totalLevels    = data?.snapshots.flatMap((s) => s.levels).length ?? 0;
  const totalRespected = data?.snapshots.flatMap((s) => s.levels).filter((l) => l.respected).length ?? 0;
  const globalAccuracy = totalLevels > 0 ? Math.round((totalRespected / totalLevels) * 100) : 0;

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between bg-bg sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <a href="/" className="text-accent font-bold text-xl sm:text-2xl tracking-[0.3em]">SORE</a>
          <a href="/" className="text-xs text-muted border border-border px-3 py-1 tracking-widest hover:text-accent hover:border-accent transition-colors hidden sm:block">ANÁLISIS</a>
          <a href="/rotacion" className="text-xs text-muted border border-border px-3 py-1 tracking-widest hover:text-accent hover:border-accent transition-colors hidden sm:block">ROTACIÓN</a>
          <span className="text-xs text-accent border border-accent px-3 py-1 tracking-widest font-bold hidden sm:block">BACKTEST</span>
        </div>
        <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }} className="text-xs text-white tracking-widest bg-red-600 hover:bg-red-700 transition-colors px-3 py-1 font-bold">
          CERRAR SESIÓN
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-[0.3em] text-accent mb-1">BACKTEST S/R</h1>
          <p className="text-xs text-muted tracking-widest">Compara los niveles guardados contra el precio real de los 5 días siguientes</p>
        </div>

        {/* Input */}
        <div className="flex gap-3">
          <input
            className="bg-bg border border-border text-text px-4 py-2.5 text-sm uppercase tracking-widest focus:outline-none focus:border-accent transition-colors flex-1 max-w-xs"
            placeholder="TICKER"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && runBacktest()}
            maxLength={10}
          />
          <button onClick={runBacktest} disabled={loading || !ticker} className="bg-accent text-white px-6 py-2.5 text-sm font-bold tracking-widest hover:opacity-80 disabled:opacity-40 transition-opacity">
            {loading ? "ANALIZANDO..." : "EJECUTAR"}
          </button>
        </div>

        {error && <div className="border border-danger text-danger text-sm p-3">{error}</div>}

        {data && (
          <>
            {/* Stats globales */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-card border border-border p-4 col-span-2 sm:col-span-1">
                <p className="text-[9px] text-muted tracking-widest">ACIERTO GLOBAL</p>
                <p className={`text-3xl font-black font-mono mt-1 ${globalAccuracy >= 60 ? "text-accent" : globalAccuracy >= 40 ? "text-warning" : "text-danger"}`}>{globalAccuracy}%</p>
                <p className="text-[10px] text-muted">{totalRespected}/{totalLevels} niveles</p>
              </div>
              {data.moduleStats.map((m) => (
                <div key={m.module} className="bg-card border border-border p-4">
                  <p className="text-[9px] text-muted tracking-widest">{m.module}</p>
                  <p className={`text-2xl font-black font-mono mt-1 ${m.accuracy >= 60 ? "text-accent" : m.accuracy >= 40 ? "text-warning" : "text-danger"}`}>{m.accuracy}%</p>
                  <p className="text-[10px] text-muted">{m.respected}/{m.total}</p>
                </div>
              ))}
            </div>

            {/* Tabla de snapshots */}
            <div className="bg-card border border-border overflow-x-auto">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-[9px] text-muted tracking-widest font-bold">DETALLE POR SNAPSHOT · {data.snapshots.length} ANÁLISIS</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted tracking-widest text-left">
                    <th className="px-4 py-3">FECHA</th>
                    <th className="px-4 py-3">SPOT</th>
                    <th className="px-4 py-3">RÉGIMEN</th>
                    <th className="px-4 py-3">SCORE</th>
                    <th className="px-4 py-3">NIVELES</th>
                    <th className="px-4 py-3">ACIERTO</th>
                  </tr>
                </thead>
                <tbody>
                  {data.snapshots.map((snap) => {
                    const respected = snap.levels.filter((l) => l.respected).length;
                    const acc = snap.levels.length > 0 ? Math.round((respected / snap.levels.length) * 100) : 0;
                    return (
                      <tr key={snap.snapshot_id} className="border-b border-border hover:bg-surface transition-colors">
                        <td className="px-4 py-3 font-mono">{snap.date}</td>
                        <td className="px-4 py-3 font-mono">${snap.spot?.toFixed(2)}</td>
                        <td className={`px-4 py-3 font-bold text-[10px] tracking-widest ${snap.regime?.toLowerCase().includes("bull") ? "text-accent" : snap.regime?.toLowerCase().includes("bear") ? "text-danger" : "text-muted"}`}>
                          {snap.regime ?? "—"}
                        </td>
                        <td className={`px-4 py-3 font-mono font-bold ${(snap.score ?? 0) >= 0 ? "text-accent" : "text-danger"}`}>
                          {snap.score != null ? `${snap.score > 0 ? "+" : ""}${snap.score}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {snap.levels.map((l, i) => (
                              <span key={i} title={`${l.type} $${l.level?.toFixed(2)}`} className={`w-3 h-3 rounded-sm inline-block ${l.respected ? "bg-accent" : "bg-danger"}`} />
                            ))}
                          </div>
                        </td>
                        <td className={`px-4 py-3 font-mono font-bold ${acc >= 60 ? "text-accent" : acc >= 40 ? "text-warning" : "text-danger"}`}>
                          {acc}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted opacity-50 tracking-widest">Verde = nivel respetado en los 5 días siguientes (brecha &lt;1.5%) · Rojo = nivel perforado</p>
          </>
        )}
      </div>
    </div>
  );
}
