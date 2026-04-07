"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

interface ModuleStat {
  module:             string;
  total_levels:       number;
  tested:             number;
  test_rate_pct:      number;
  respected:          number;
  accuracy_pct:       number;
  direction_correct:  number;
  direction_accuracy: number;
  avg_breach_pct:     number;
  avg_threshold_pct?: number;
}

interface BacktestResult {
  id:                number;
  snapshot_id:       number;
  ticker:            string;
  module:            string;
  level_type:        string;
  level_price:       number;
  spot_at_snapshot:  number;
  regime:            string;
  m7_verdict:        string;
  eval_window_days:  number;
  was_tested:        boolean;
  respected:         boolean | null;
  breach_pct:        number | null;
  first_test_date:   string | null;
  atr14:             number;
  dynamic_threshold: number;
  direction_correct: boolean | null;
  created_at:        string;
}

function AccuracyBar({ pct, label }: { pct: number; label: string }) {
  const color = pct >= 65 ? "#22c55e" : pct >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted tracking-widest">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 bg-surface rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-card border border-border p-4 space-y-1">
      <p className="text-[9px] text-muted tracking-widest font-bold">{label}</p>
      <p className={`text-2xl font-black font-mono ${color ?? "text-text"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </div>
  );
}

export default function BacktestPage() {
  const [ticker, setTicker]         = useState("");
  const [running, setRunning]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [stats, setStats]           = useState<ModuleStat[]>([]);
  const [results, setResults]       = useState<BacktestResult[]>([]);
  const [ran, setRan]               = useState(false);
  const [summary, setSummary]       = useState<{ snapshots_processed?: number; levels_evaluated?: number; splits_detected?: number } | null>(null);
  const [moduleFilter, setModuleFilter] = useState("GLOBAL");
  const [showTested, setShowTested] = useState(true);

  // Cargar resultados existentes al cambiar ticker
  async function loadResults(t: string) {
    if (!t) return;
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/backtest/results?ticker=${t}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      setStats(json.stats ?? []);
      setResults(json.results ?? []);
      setRan(json.ran ?? false);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  // Ejecutar nuevo backtest
  async function runBacktest() {
    if (!ticker) return;
    setRunning(true);
    setError("");
    try {
      const res  = await fetch(`/api/backtest/run?ticker=${ticker}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      setSummary(json);
      await loadResults(ticker);
    } catch (e: any) { setError(e.message); }
    setRunning(false);
  }

  const globalStat = stats.find((s) => s.module === "GLOBAL");
  const moduleStat = stats.find((s) => s.module === moduleFilter) ?? globalStat;

  const filteredResults = results.filter((r) => {
    if (moduleFilter !== "GLOBAL" && r.module !== moduleFilter) return false;
    if (showTested && !r.was_tested) return false;
    return true;
  });

  const chartData = stats.filter((s) => s.module !== "GLOBAL").map((s) => ({
    name: s.module,
    accuracy:   s.accuracy_pct,
    direction:  s.direction_accuracy,
    test_rate:  s.test_rate_pct,
  }));

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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Título */}
        <div>
          <h1 className="text-2xl font-black tracking-[0.3em] text-accent mb-1">BACKTEST S/R</h1>
          <p className="text-xs text-muted tracking-widest">Evaluación de niveles GEX contra precio real · ATR dinámico · ventana por módulo · detección de splits</p>
        </div>

        {/* Input */}
        <div className="flex gap-3 items-start flex-wrap">
          <input
            className="bg-bg border border-border text-text px-4 py-2.5 text-sm uppercase tracking-widest focus:outline-none focus:border-accent transition-colors w-40"
            placeholder="TICKER"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") { loadResults(ticker); } }}
            maxLength={10}
          />
          <button onClick={() => loadResults(ticker)} disabled={loading || !ticker} className="border border-border text-text px-5 py-2.5 text-sm font-bold tracking-widest hover:border-accent hover:text-accent disabled:opacity-40 transition-colors">
            {loading ? "CARGANDO..." : "VER GUARDADOS"}
          </button>
          <button onClick={runBacktest} disabled={running || !ticker} className="bg-accent text-white px-6 py-2.5 text-sm font-bold tracking-widest hover:opacity-80 disabled:opacity-40 transition-opacity">
            {running ? "PROCESANDO..." : "EJECUTAR BACKTEST"}
          </button>
          <div className="text-[10px] text-muted self-center space-y-0.5">
            <p>VER GUARDADOS — lee resultados previos sin llamar a Yahoo</p>
            <p>EJECUTAR — recalcula todo (fetcha precios, detecta splits, guarda en BD)</p>
          </div>
        </div>

        {error && <div className="border border-danger text-danger text-sm p-3 tracking-widest">{error}</div>}

        {summary && (
          <div className="bg-surface border border-border px-4 py-3 text-xs text-muted tracking-widest flex gap-6">
            <span>SNAPSHOTS PROCESADOS <span className="text-text font-bold">{summary.snapshots_processed}</span></span>
            <span>NIVELES EVALUADOS <span className="text-text font-bold">{summary.levels_evaluated}</span></span>
            <span>SPLITS DETECTADOS <span className={`font-bold ${(summary.splits_detected ?? 0) > 0 ? "text-warning" : "text-text"}`}>{summary.splits_detected}</span></span>
          </div>
        )}

        {ran && stats.length > 0 && (
          <>
            {/* Stats globales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="ACIERTO GLOBAL" value={`${globalStat?.accuracy_pct ?? 0}%`} sub={`${globalStat?.respected}/${globalStat?.tested} testeados`} color={globalStat && globalStat.accuracy_pct >= 60 ? "text-accent" : globalStat && globalStat.accuracy_pct >= 40 ? "text-warning" : "text-danger"} />
              <StatCard label="DIRECCIÓN CORRECTA" value={`${globalStat?.direction_accuracy ?? 0}%`} sub="vs veredicto M7" color="text-accent" />
              <StatCard label="TASA DE TEST" value={`${globalStat?.test_rate_pct ?? 0}%`} sub="niveles que tocó el precio" />
              <StatCard label="BRECHA PROM." value={`${globalStat?.avg_breach_pct ?? 0}%`} sub="cuando se perforó" color="text-danger" />
            </div>

            {/* Gráfico por módulo */}
            <div className="bg-card border border-border p-5 space-y-3">
              <p className="text-[9px] text-muted tracking-widest font-bold">COMPARATIVA POR MÓDULO</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                  <ReferenceLine y={50} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 2" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #2d2d44", fontSize: 11 }}
                    formatter={(v: any, n: string) => [`${v}%`, n === "accuracy" ? "Acierto" : n === "direction" ? "Dirección" : "Tasa test"]}
                  />
                  <Bar dataKey="accuracy"  name="accuracy"  radius={[2,2,0,0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.accuracy >= 60 ? "#22c55e" : entry.accuracy >= 40 ? "#f59e0b" : "#ef4444"} />
                    ))}
                  </Bar>
                  <Bar dataKey="direction" name="direction" fill="#6366f1" opacity={0.7} radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 text-[9px] text-muted">
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-accent inline-block" />Acierto S/R</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-indigo-500 inline-block" />Dirección correcta</span>
              </div>
            </div>

            {/* Stats por módulo — barras */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {stats.filter((s) => s.module !== "GLOBAL").map((s) => (
                <div key={s.module} className="bg-card border border-border p-4 space-y-3">
                  <p className="text-xs font-black tracking-widest text-accent">{s.module}</p>
                  <AccuracyBar pct={s.accuracy_pct}   label="ACIERTO S/R" />
                  <AccuracyBar pct={s.direction_accuracy} label="DIRECCIÓN" />
                  <AccuracyBar pct={s.test_rate_pct}  label="TASA TEST" />
                  <div className="text-[10px] text-muted pt-1 border-t border-border">
                    <p>{s.tested}/{s.total_levels} testeados · brecha prom. <span className="text-danger font-mono">{s.avg_breach_pct}%</span></p>
                  </div>
                </div>
              ))}
            </div>

            {/* Filtros tabla detalle */}
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-[9px] text-muted tracking-widest font-bold">MÓDULO:</p>
              {["GLOBAL","M1","M2","M3","M5"].map((m) => (
                <button key={m} onClick={() => setModuleFilter(m)} className={`text-xs px-3 py-1 border tracking-widest transition-colors ${moduleFilter === m ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
                  {m}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <input type="checkbox" id="showTested" checked={showTested} onChange={(e) => setShowTested(e.target.checked)} className="accent-accent" />
                <label htmlFor="showTested" className="text-xs text-muted tracking-widest cursor-pointer">SOLO TESTEADOS</label>
              </div>
            </div>

            {/* Tabla detalle */}
            <div className="bg-card border border-border overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted tracking-widest text-left bg-surface">
                    <th className="px-3 py-3">MOD</th>
                    <th className="px-3 py-3">TIPO</th>
                    <th className="px-3 py-3">NIVEL</th>
                    <th className="px-3 py-3">SPOT</th>
                    <th className="px-3 py-3">VENTANA</th>
                    <th className="px-3 py-3">ATR</th>
                    <th className="px-3 py-3">THRESHOLD</th>
                    <th className="px-3 py-3">TESTEADO</th>
                    <th className="px-3 py-3">RESPETADO</th>
                    <th className="px-3 py-3">BRECHA</th>
                    <th className="px-3 py-3">DIR OK</th>
                    <th className="px-3 py-3">RÉGIMEN</th>
                    <th className="px-3 py-3">FECHA TEST</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.slice(0, 200).map((r) => (
                    <tr key={r.id} className="border-b border-border hover:bg-surface transition-colors">
                      <td className="px-3 py-2 font-bold text-accent">{r.module}</td>
                      <td className={`px-3 py-2 font-bold text-[10px] ${r.level_type === "support" ? "text-accent" : "text-danger"}`}>{r.level_type === "support" ? "SUP" : "RES"}</td>
                      <td className="px-3 py-2 font-mono">${r.level_price?.toFixed(2)}</td>
                      <td className="px-3 py-2 font-mono text-muted">${r.spot_at_snapshot?.toFixed(2)}</td>
                      <td className="px-3 py-2 text-muted">{r.eval_window_days}d</td>
                      <td className="px-3 py-2 font-mono text-muted">{r.atr14?.toFixed(2)}</td>
                      <td className="px-3 py-2 font-mono text-muted">{r.dynamic_threshold != null ? `${(r.dynamic_threshold * 100).toFixed(2)}%` : "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${r.was_tested ? "bg-accent/20 text-accent" : "bg-surface text-muted"}`}>
                          {r.was_tested ? "SÍ" : "NO"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {r.respected === null ? <span className="text-muted">—</span> :
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${r.respected ? "bg-accent/20 text-accent" : "bg-danger/20 text-danger"}`}>
                            {r.respected ? "SÍ" : "NO"}
                          </span>}
                      </td>
                      <td className={`px-3 py-2 font-mono ${(r.breach_pct ?? 0) > 0 ? "text-danger" : "text-accent"}`}>
                        {r.breach_pct != null ? `${(r.breach_pct * 100).toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.direction_correct === null ? <span className="text-muted">—</span> :
                          <span className={r.direction_correct ? "text-accent font-bold" : "text-danger font-bold"}>
                            {r.direction_correct ? "✓" : "✗"}
                          </span>}
                      </td>
                      <td className="px-3 py-2 text-muted text-[10px]">{r.regime ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-muted">{r.first_test_date ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredResults.length > 200 && (
                <p className="text-[10px] text-muted text-center py-2">Mostrando 200 de {filteredResults.length} resultados</p>
              )}
            </div>
          </>
        )}

        {!ran && !loading && !running && !error && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted">
            <p className="text-sm tracking-widest font-bold">BACKTEST S/R INSTITUCIONAL</p>
            <p className="text-xs opacity-60 text-center max-w-md">Ingresa un ticker y presiona EJECUTAR para analizar la precisión de los niveles GEX guardados contra el precio real</p>
          </div>
        )}
      </div>
    </div>
  );
}
