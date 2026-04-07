"use client";

import { useState, useEffect, useCallback } from "react";

interface ProximityAlert {
  ticker:         string;
  spot_current:   number;
  level:          number;
  level_type:     "support" | "resistance";
  module:         string;
  distance_usd:   number;
  distance_pct:   number;
  level_age_days: number;
  regime:         string | null;
  m7_verdict:     string | null;
  snapshot_date:  string;
}

interface ScanMeta {
  tickers_scanned: number;
  prices_fetched:  number;
  threshold_usd:   number;
  min_age_days:    number;
  cutoff_date:     string;
}

function DistanceBar({ usd, threshold }: { usd: number; threshold: number }) {
  const pct   = Math.min(100, ((threshold - usd) / threshold) * 100);
  const color = usd <= 1 ? "#ef4444" : usd <= 2.5 ? "#f59e0b" : "#22c55e";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-surface rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono font-bold text-[11px]" style={{ color }}>${usd.toFixed(2)}</span>
    </div>
  );
}

export default function AlertasPage() {
  const [threshold,  setThreshold]  = useState(5);
  const [minAge,     setMinAge]     = useState(30);
  const [loading,    setLoading]    = useState(false);
  const [alerts,     setAlerts]     = useState<ProximityAlert[]>([]);
  const [meta,       setMeta]       = useState<ScanMeta | null>(null);
  const [error,      setError]      = useState("");
  const [lastScan,   setLastScan]   = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "support" | "resistance">("ALL");
  const [moduleFilter, setModuleFilter] = useState("ALL");

  const runScan = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/scanner/proximity?threshold=${threshold}&min_age_days=${minAge}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al escanear");
      setAlerts(json.alerts ?? []);
      setMeta({ tickers_scanned: json.tickers_scanned, prices_fetched: json.prices_fetched, threshold_usd: json.threshold_usd, min_age_days: json.min_age_days, cutoff_date: json.cutoff_date });
      setLastScan(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [threshold, minAge]);

  // Auto-scan al cargar
  useEffect(() => { runScan(); }, []);

  const filtered = alerts.filter((a) => {
    if (typeFilter !== "ALL" && a.level_type !== typeFilter) return false;
    if (moduleFilter !== "ALL" && a.module !== moduleFilter) return false;
    return true;
  });

  const criticalCount = alerts.filter((a) => a.distance_usd <= 1).length;
  const warningCount  = alerts.filter((a) => a.distance_usd > 1 && a.distance_usd <= 2.5).length;
  const normalCount   = alerts.filter((a) => a.distance_usd > 2.5).length;

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between bg-bg sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <a href="/" className="text-accent font-bold text-xl sm:text-2xl tracking-[0.3em]">SORE</a>
          <a href="/" className="text-xs text-muted border border-border px-3 py-1 tracking-widest hover:text-accent hover:border-accent transition-colors hidden sm:block">ANÁLISIS</a>
          <a href="/rotacion" className="text-xs text-muted border border-border px-3 py-1 tracking-widest hover:text-accent hover:border-accent transition-colors hidden sm:block">ROTACIÓN</a>
          <a href="/backtest" className="text-xs text-muted border border-border px-3 py-1 tracking-widest hover:text-accent hover:border-accent transition-colors hidden sm:block">BACKTEST</a>
          <span className="text-xs text-accent border border-accent px-3 py-1 tracking-widest font-bold hidden sm:block">ALERTAS</span>
        </div>
        <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }} className="text-xs text-white tracking-widest bg-red-600 hover:bg-red-700 transition-colors px-3 py-1 font-bold">
          CERRAR SESIÓN
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Título */}
        <div>
          <h1 className="text-2xl font-black tracking-[0.3em] text-accent mb-1">SCANNER DE PROXIMIDAD</h1>
          <p className="text-xs text-muted tracking-widest">Tickers con precio actual dentro del umbral de un nivel S/R confirmado · niveles con antigüedad mínima configurable</p>
        </div>

        {/* Controles */}
        <div className="bg-card border border-border p-4 flex flex-wrap gap-6 items-end">
          <div className="space-y-1.5">
            <p className="text-[9px] text-muted tracking-widest font-bold">UMBRAL DE DISTANCIA ($)</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 5, 10, 15].map((v) => (
                <button key={v} onClick={() => setThreshold(v)} className={`text-xs px-3 py-1.5 border tracking-widest transition-colors font-mono ${threshold === v ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
                  ${v}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[9px] text-muted tracking-widest font-bold">ANTIGÜEDAD MÍNIMA DEL NIVEL</p>
            <div className="flex items-center gap-2">
              {[14, 30, 45, 60, 90].map((v) => (
                <button key={v} onClick={() => setMinAge(v)} className={`text-xs px-3 py-1.5 border tracking-widest transition-colors ${minAge === v ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
                  {v}d
                </button>
              ))}
            </div>
          </div>

          <button onClick={runScan} disabled={loading} className="bg-accent text-white px-6 py-2.5 text-sm font-bold tracking-widest hover:opacity-80 disabled:opacity-40 transition-opacity">
            {loading ? "ESCANEANDO..." : "ESCANEAR"}
          </button>

          {lastScan && !loading && (
            <p className="text-[10px] text-muted self-center">última actualización: {lastScan}</p>
          )}
        </div>

        {error && <div className="border border-danger text-danger text-sm p-3 tracking-widest">{error}</div>}

        {/* Resumen */}
        {meta && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-border p-4 space-y-1">
              <p className="text-[9px] text-muted tracking-widest font-bold">TICKERS ESCANEADOS</p>
              <p className="text-2xl font-black font-mono text-text">{meta.tickers_scanned}</p>
              <p className="text-[10px] text-muted">con niveles &gt;{meta.min_age_days}d de antigüedad</p>
            </div>
            <div className="bg-card border border-border p-4 space-y-1">
              <p className="text-[9px] text-muted tracking-widest font-bold">ALERTAS TOTALES</p>
              <p className={`text-2xl font-black font-mono ${alerts.length > 0 ? "text-warning" : "text-muted"}`}>{alerts.length}</p>
              <p className="text-[10px] text-muted">dentro de ${meta.threshold_usd}</p>
            </div>
            <div className="bg-card border border-border p-4 space-y-1">
              <p className="text-[9px] text-muted tracking-widest font-bold">CRÍTICAS ≤$1</p>
              <p className={`text-2xl font-black font-mono ${criticalCount > 0 ? "text-danger" : "text-muted"}`}>{criticalCount}</p>
              <p className="text-[10px] text-muted">riesgo inmediato</p>
            </div>
            <div className="bg-card border border-border p-4 space-y-1">
              <p className="text-[9px] text-muted tracking-widest font-bold">ADVERTENCIA $1–$2.50</p>
              <p className={`text-2xl font-black font-mono ${warningCount > 0 ? "text-warning" : "text-muted"}`}>{warningCount}</p>
              <p className="text-[10px] text-muted">zona de atención</p>
            </div>
          </div>
        )}

        {/* Filtros */}
        {alerts.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[9px] text-muted tracking-widest font-bold">TIPO:</p>
            {(["ALL", "support", "resistance"] as const).map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)} className={`text-xs px-3 py-1 border tracking-widest transition-colors ${typeFilter === t ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
                {t === "ALL" ? "TODOS" : t === "support" ? "SOPORTE" : "RESISTENCIA"}
              </button>
            ))}
            <div className="flex items-center gap-2 ml-4">
              <p className="text-[9px] text-muted tracking-widest font-bold">MÓDULO:</p>
              {["ALL", "M1", "M2", "M3", "M5"].map((m) => (
                <button key={m} onClick={() => setModuleFilter(m)} className={`text-xs px-3 py-1 border tracking-widest transition-colors ${moduleFilter === m ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
                  {m}
                </button>
              ))}
            </div>
            <p className="ml-auto text-[10px] text-muted">{filtered.length} alertas</p>
          </div>
        )}

        {/* Tabla de alertas */}
        {filtered.length > 0 ? (
          <div className="bg-card border border-border overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted tracking-widest text-left bg-surface">
                  <th className="px-3 py-3">TICKER</th>
                  <th className="px-3 py-3">SPOT ACTUAL</th>
                  <th className="px-3 py-3">NIVEL</th>
                  <th className="px-3 py-3">TIPO</th>
                  <th className="px-3 py-3">MOD</th>
                  <th className="px-3 py-3">DISTANCIA</th>
                  <th className="px-3 py-3">DIST %</th>
                  <th className="px-3 py-3">EDAD NIVEL</th>
                  <th className="px-3 py-3">RÉGIMEN</th>
                  <th className="px-3 py-3">VEREDICTO M7</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => {
                  const isCritical = a.distance_usd <= 1;
                  const isWarning  = a.distance_usd > 1 && a.distance_usd <= 2.5;
                  const rowBg      = isCritical ? "border-danger/30 bg-danger/5" : isWarning ? "border-warning/20 bg-warning/5" : "";
                  return (
                    <tr key={i} className={`border-b border-border hover:bg-surface transition-colors ${rowBg}`}>
                      <td className="px-3 py-2.5">
                        <a href={`/?ticker=${a.ticker}`} className="font-black text-accent hover:underline tracking-widest">{a.ticker}</a>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold">${a.spot_current.toFixed(2)}</td>
                      <td className="px-3 py-2.5 font-mono">${a.level.toFixed(2)}</td>
                      <td className={`px-3 py-2.5 font-bold text-[10px] ${a.level_type === "support" ? "text-accent" : "text-danger"}`}>
                        {a.level_type === "support" ? "SOPORTE" : "RESISTENCIA"}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-muted">{a.module}</td>
                      <td className="px-3 py-2.5">
                        <DistanceBar usd={a.distance_usd} threshold={threshold} />
                      </td>
                      <td className={`px-3 py-2.5 font-mono text-[10px] ${a.distance_pct <= 0.5 ? "text-danger font-bold" : "text-muted"}`}>
                        {a.distance_pct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5 text-muted">
                        <span className={`${a.level_age_days >= 60 ? "text-accent font-bold" : ""}`}>{a.level_age_days}d</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted text-[10px]">{a.regime ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted text-[10px] max-w-[160px] truncate">{a.m7_verdict ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !loading && meta && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted">
              <p className="text-sm tracking-widest font-bold">SIN ALERTAS</p>
              <p className="text-xs opacity-60">Ningún ticker está dentro de ${threshold} de un nivel confirmado hace {minAge}+ días</p>
              <p className="text-xs opacity-40 mt-1">Analiza más tickers en M7 para ampliar la cobertura del scanner</p>
            </div>
          )
        )}

        {!meta && !loading && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted">
            <p className="text-sm tracking-widest font-bold">SCANNER DE PROXIMIDAD S/R</p>
            <p className="text-xs opacity-60 text-center max-w-md">Detecta automáticamente todos los tickers analizados que están cerca de un nivel de soporte o resistencia confirmado</p>
          </div>
        )}

      </div>
    </div>
  );
}
