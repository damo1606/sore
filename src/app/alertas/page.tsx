"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_WATCHLIST, LISTA_1, LISTA_2, LISTA_3, LIST_LABELS, LIST_COLORS, type WatchlistTicker } from "@/lib/watchlist";

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

interface BatchState {
  running:   boolean;
  total:     number;
  done:      number;
  current:   string;
  errors:    string[];
  completed: string[];
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

const LISTS = [
  { id: 1, tickers: LISTA_1 },
  { id: 2, tickers: LISTA_2 },
  { id: 3, tickers: LISTA_3 },
];

const BATCH_SIZE  = 3;
const BATCH_DELAY = 1200; // ms entre lotes

export default function AlertasPage() {
  const [threshold,    setThreshold]    = useState(5);
  const [minAge,       setMinAge]       = useState(30);
  const [loading,      setLoading]      = useState(false);
  const [alerts,       setAlerts]       = useState<ProximityAlert[]>([]);
  const [meta,         setMeta]         = useState<ScanMeta | null>(null);
  const [error,        setError]        = useState("");
  const [lastScan,     setLastScan]     = useState<string | null>(null);
  const [typeFilter,   setTypeFilter]   = useState<"ALL" | "support" | "resistance">("ALL");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [listFilter,   setListFilter]   = useState<0 | 1 | 2 | 3>(0);
  const [analyzedSet,  setAnalyzedSet]  = useState<Set<string>>(new Set());
  const [batch,        setBatch]        = useState<BatchState>({ running: false, total: 0, done: 0, current: "", errors: [], completed: [] });
  const stopRef = useRef(false);

  const watchlistTickers = DEFAULT_WATCHLIST.map((w) => w.ticker);

  // ── Cargar estado de análisis (qué tickers ya tienen snapshot) ──────────────
  const loadStatus = useCallback(async () => {
    try {
      const res  = await fetch(`/api/watchlist/status?tickers=${watchlistTickers.join(",")}`);
      const json = await res.json();
      setAnalyzedSet(new Set<string>(json.analyzed ?? []));
    } catch {}
  }, []);

  // ── Scanner de proximidad ───────────────────────────────────────────────────
  const runScan = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/scanner/proximity?threshold=${threshold}&min_age_days=${minAge}&tickers=${watchlistTickers.join(",")}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al escanear");
      setAlerts(json.alerts ?? []);
      setMeta({ tickers_scanned: json.tickers_scanned, prices_fetched: json.prices_fetched, threshold_usd: json.threshold_usd, min_age_days: json.min_age_days, cutoff_date: json.cutoff_date });
      setLastScan(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [threshold, minAge]);

  // ── Batch analyzer ──────────────────────────────────────────────────────────
  const runBatch = useCallback(async () => {
    const pending = DEFAULT_WATCHLIST.map((w) => w.ticker).filter((t) => !analyzedSet.has(t));
    if (!pending.length) return;

    stopRef.current = false;
    setBatch({ running: true, total: pending.length, done: 0, current: "", errors: [], completed: [] });

    const errors:    string[] = [];
    const completed: string[] = [];

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      if (stopRef.current) break;

      const lote = pending.slice(i, i + BATCH_SIZE);

      await Promise.all(lote.map(async (ticker) => {
        setBatch((prev) => ({ ...prev, current: ticker }));
        try {
          const res = await fetch(`/api/analysis7?ticker=${ticker}`);
          if (res.ok) {
            completed.push(ticker);
            setAnalyzedSet((prev) => new Set(Array.from(prev).concat(ticker)));
          } else {
            const j = await res.json().catch(() => ({}));
            errors.push(`${ticker}: ${j.error ?? res.status}`);
          }
        } catch (e: any) {
          errors.push(`${ticker}: ${e.message}`);
        }
        setBatch((prev) => ({ ...prev, done: prev.done + 1, completed: [...completed], errors: [...errors] }));
      }));

      if (i + BATCH_SIZE < pending.length && !stopRef.current) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY));
      }
    }

    setBatch((prev) => ({ ...prev, running: false, current: "" }));

    // Refrescar scanner después del batch
    if (completed.length > 0) await runScan();
  }, [analyzedSet, runScan]);

  const stopBatch = () => { stopRef.current = true; };

  useEffect(() => {
    loadStatus().then(() => runScan());
  }, []);

  const pendingList  = DEFAULT_WATCHLIST.filter((w) => !analyzedSet.has(w.ticker));
  const pendingCount = pendingList.length;

  const filtered = alerts.filter((a) => {
    if (typeFilter !== "ALL" && a.level_type !== typeFilter) return false;
    if (moduleFilter !== "ALL" && a.module !== moduleFilter) return false;
    if (listFilter !== 0 && DEFAULT_WATCHLIST.find((w) => w.ticker === a.ticker)?.list !== listFilter) return false;
    return true;
  });

  const criticalCount = alerts.filter((a) => a.distance_usd <= 1).length;
  const warningCount  = alerts.filter((a) => a.distance_usd > 1 && a.distance_usd <= 2.5).length;
  const batchPct      = batch.total > 0 ? Math.round((batch.done / batch.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between bg-bg sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <a href="/" className="text-accent font-bold text-xl sm:text-2xl tracking-[0.3em]">SORE</a>
          <a href="/" className="text-xs text-muted border border-border px-3 py-1 tracking-widest hover:text-accent hover:border-accent transition-colors hidden sm:block">ANALISIS</a>
          <a href="/rotacion" className="text-xs text-muted border border-border px-3 py-1 tracking-widest hover:text-accent hover:border-accent transition-colors hidden sm:block">ROTACION</a>
          <a href="/backtest" className="text-xs text-muted border border-border px-3 py-1 tracking-widest hover:text-accent hover:border-accent transition-colors hidden sm:block">BACKTEST</a>
          <span className="text-xs text-accent border border-accent px-3 py-1 tracking-widest font-bold hidden sm:block">ALERTAS</span>
        </div>
        <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }} className="text-xs text-white tracking-widest bg-red-600 hover:bg-red-700 transition-colors px-3 py-1 font-bold">
          CERRAR SESION
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Título */}
        <div>
          <h1 className="text-2xl font-black tracking-[0.3em] text-accent mb-1">SCANNER DE PROXIMIDAD</h1>
          <p className="text-xs text-muted tracking-widest">37 tickers · 3 listas · niveles S/R confirmados · distancia configurable</p>
        </div>

        {/* Batch Analyzer */}
        <div className="bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[9px] text-muted tracking-widest font-bold">ANALIZADOR BATCH · M7</p>
              <p className="text-[10px] text-muted mt-0.5">
                {analyzedSet.size}/37 tickers analizados
                {pendingCount > 0 && <span className="text-warning ml-2">· {pendingCount} pendientes</span>}
                {pendingCount === 0 && <span className="text-accent ml-2">· todos completos</span>}
              </p>
            </div>
            <div className="flex gap-2">
              {!batch.running ? (
                <button
                  onClick={runBatch}
                  disabled={pendingCount === 0}
                  className="bg-accent text-white px-5 py-2 text-xs font-bold tracking-widest hover:opacity-80 disabled:opacity-30 transition-opacity"
                >
                  ANALIZAR PENDIENTES ({pendingCount})
                </button>
              ) : (
                <button onClick={stopBatch} className="border border-danger text-danger px-5 py-2 text-xs font-bold tracking-widest hover:bg-danger/10 transition-colors">
                  DETENER
                </button>
              )}
              <button onClick={loadStatus} disabled={batch.running} className="border border-border text-muted px-4 py-2 text-xs tracking-widest hover:text-text hover:border-accent transition-colors disabled:opacity-30">
                REFRESCAR
              </button>
            </div>
          </div>

          {/* Barra de progreso */}
          {(batch.running || batch.done > 0) && (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] text-muted">
                <span>{batch.running ? `Analizando ${batch.current}...` : "Completado"}</span>
                <span className="font-mono font-bold text-text">{batch.done}/{batch.total} · {batchPct}%</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${batchPct}%`, backgroundColor: batch.running ? "#6366f1" : "#22c55e" }}
                />
              </div>
              {batch.completed.length > 0 && (
                <p className="text-[10px] text-accent">
                  Completados: {batch.completed.join(", ")}
                </p>
              )}
              {batch.errors.length > 0 && (
                <div className="text-[10px] text-danger space-y-0.5">
                  {batch.errors.map((e, i) => <p key={i}>✗ {e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Watchlist visual */}
        <div className="space-y-3">
          {LISTS.map(({ id, tickers }) => (
            <div key={id} className="bg-card border border-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: LIST_COLORS[id] }} />
                <p className="text-[9px] font-bold tracking-widest" style={{ color: LIST_COLORS[id] }}>
                  LISTA {id} · {LIST_LABELS[id]} · {tickers.length} tickers
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tickers.map((w: WatchlistTicker) => {
                  const hasData  = analyzedSet.has(w.ticker);
                  const hasAlert = alerts.some((a) => a.ticker === w.ticker);
                  const isRunning = batch.current === w.ticker;
                  return (
                    <a
                      key={w.ticker}
                      href={`/?ticker=${w.ticker}`}
                      title={w.label}
                      className={`px-2.5 py-1 text-[10px] font-bold tracking-widest border transition-all ${
                        isRunning
                          ? "border-indigo-400 text-indigo-400 animate-pulse"
                          : hasAlert
                          ? "bg-warning/20 border-warning text-warning"
                          : hasData
                          ? "border-border text-text hover:border-accent hover:text-accent"
                          : "border-border/40 text-muted/50 hover:border-border hover:text-muted"
                      }`}
                    >
                      {w.ticker}
                      {hasAlert && <span className="ml-1 text-[8px]">●</span>}
                      {isRunning && <span className="ml-1 text-[8px]">⟳</span>}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {pendingCount > 0 && !batch.running && (
          <p className="text-[10px] text-muted tracking-widest">
            <span className="text-warning font-bold">{pendingCount} tickers</span> sin analisis — aparecen en gris.
            Usa el boton <span className="text-accent font-bold">ANALIZAR PENDIENTES</span> para poblarlos automaticamente, o analiza uno por uno en{" "}
            <a href="/" className="text-accent underline">M7</a>.
          </p>
        )}

        {/* Controles del scanner */}
        <div className="bg-card border border-border p-4 flex flex-wrap gap-6 items-end">
          <div className="space-y-1.5">
            <p className="text-[9px] text-muted tracking-widest font-bold">UMBRAL DE DISTANCIA ($)</p>
            <div className="flex items-center gap-2 flex-wrap">
              {[1, 2, 3, 5, 10, 15].map((v) => (
                <button key={v} onClick={() => setThreshold(v)} className={`text-xs px-3 py-1.5 border tracking-widest transition-colors font-mono ${threshold === v ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
                  ${v}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[9px] text-muted tracking-widest font-bold">ANTIGUEDAD MINIMA DEL NIVEL</p>
            <div className="flex items-center gap-2 flex-wrap">
              {[14, 30, 45, 60, 90].map((v) => (
                <button key={v} onClick={() => setMinAge(v)} className={`text-xs px-3 py-1.5 border tracking-widest transition-colors ${minAge === v ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
                  {v}d
                </button>
              ))}
            </div>
          </div>

          <button onClick={runScan} disabled={loading || batch.running} className="bg-accent text-white px-6 py-2.5 text-sm font-bold tracking-widest hover:opacity-80 disabled:opacity-40 transition-opacity">
            {loading ? "ESCANEANDO..." : "ESCANEAR"}
          </button>

          {lastScan && !loading && (
            <p className="text-[10px] text-muted self-center">ultima actualizacion: {lastScan}</p>
          )}
        </div>

        {error && <div className="border border-danger text-danger text-sm p-3 tracking-widest">{error}</div>}

        {/* Resumen */}
        {meta && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-border p-4 space-y-1">
              <p className="text-[9px] text-muted tracking-widest font-bold">TICKERS CON DATOS</p>
              <p className="text-2xl font-black font-mono text-text">{meta.tickers_scanned}<span className="text-sm text-muted font-normal"> / 37</span></p>
              <p className="text-[10px] text-muted">con niveles &gt;{meta.min_age_days}d</p>
            </div>
            <div className="bg-card border border-border p-4 space-y-1">
              <p className="text-[9px] text-muted tracking-widest font-bold">ALERTAS TOTALES</p>
              <p className={`text-2xl font-black font-mono ${alerts.length > 0 ? "text-warning" : "text-muted"}`}>{alerts.length}</p>
              <p className="text-[10px] text-muted">dentro de ${meta.threshold_usd}</p>
            </div>
            <div className="bg-card border border-border p-4 space-y-1">
              <p className="text-[9px] text-muted tracking-widest font-bold">CRITICAS ≤$1</p>
              <p className={`text-2xl font-black font-mono ${criticalCount > 0 ? "text-danger" : "text-muted"}`}>{criticalCount}</p>
              <p className="text-[10px] text-muted">riesgo inmediato</p>
            </div>
            <div className="bg-card border border-border p-4 space-y-1">
              <p className="text-[9px] text-muted tracking-widest font-bold">ADVERTENCIA $1–$2.50</p>
              <p className={`text-2xl font-black font-mono ${warningCount > 0 ? "text-warning" : "text-muted"}`}>{warningCount}</p>
              <p className="text-[10px] text-muted">zona de atencion</p>
            </div>
          </div>
        )}

        {/* Filtros */}
        {alerts.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[9px] text-muted tracking-widest font-bold">LISTA:</p>
            {([0, 1, 2, 3] as const).map((l) => (
              <button key={l} onClick={() => setListFilter(l)} className={`text-xs px-3 py-1 border tracking-widest transition-colors ${listFilter === l ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
                {l === 0 ? "TODAS" : `L${l}`}
              </button>
            ))}
            <div className="flex items-center gap-2 ml-2">
              {(["ALL", "support", "resistance"] as const).map((t) => (
                <button key={t} onClick={() => setTypeFilter(t)} className={`text-xs px-3 py-1 border tracking-widest transition-colors ${typeFilter === t ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
                  {t === "ALL" ? "S+R" : t === "support" ? "SUP" : "RES"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {["ALL", "M1", "M2", "M3", "M5"].map((m) => (
                <button key={m} onClick={() => setModuleFilter(m)} className={`text-xs px-3 py-1 border tracking-widest transition-colors ${moduleFilter === m ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
                  {m}
                </button>
              ))}
            </div>
            <p className="ml-auto text-[10px] text-muted">{filtered.length} alertas</p>
          </div>
        )}

        {/* Tabla */}
        {filtered.length > 0 ? (
          <div className="bg-card border border-border overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted tracking-widest text-left bg-surface">
                  <th className="px-3 py-3">TICKER</th>
                  <th className="px-3 py-3">LISTA</th>
                  <th className="px-3 py-3">SPOT</th>
                  <th className="px-3 py-3">NIVEL</th>
                  <th className="px-3 py-3">TIPO</th>
                  <th className="px-3 py-3">MOD</th>
                  <th className="px-3 py-3">DISTANCIA</th>
                  <th className="px-3 py-3">DIST %</th>
                  <th className="px-3 py-3">EDAD NIVEL</th>
                  <th className="px-3 py-3">REGIMEN</th>
                  <th className="px-3 py-3">VEREDICTO M7</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => {
                  const wl        = DEFAULT_WATCHLIST.find((w) => w.ticker === a.ticker);
                  const listId    = wl?.list ?? 0;
                  const listColor = LIST_COLORS[listId] ?? "#6b7280";
                  const isCrit    = a.distance_usd <= 1;
                  const isWarn    = a.distance_usd > 1 && a.distance_usd <= 2.5;
                  const rowBg     = isCrit ? "border-danger/30 bg-danger/5" : isWarn ? "border-warning/20 bg-warning/5" : "";
                  return (
                    <tr key={i} className={`border-b border-border hover:bg-surface transition-colors ${rowBg}`}>
                      <td className="px-3 py-2.5">
                        <a href={`/?ticker=${a.ticker}`} className="font-black text-accent hover:underline tracking-widest">{a.ticker}</a>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: listColor, backgroundColor: `${listColor}20` }}>L{listId}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold">${a.spot_current.toFixed(2)}</td>
                      <td className="px-3 py-2.5 font-mono">${a.level.toFixed(2)}</td>
                      <td className={`px-3 py-2.5 font-bold text-[10px] ${a.level_type === "support" ? "text-accent" : "text-danger"}`}>
                        {a.level_type === "support" ? "SUP" : "RES"}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-muted">{a.module}</td>
                      <td className="px-3 py-2.5"><DistanceBar usd={a.distance_usd} threshold={threshold} /></td>
                      <td className={`px-3 py-2.5 font-mono text-[10px] ${a.distance_pct <= 0.5 ? "text-danger font-bold" : "text-muted"}`}>
                        {a.distance_pct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5 text-muted">
                        <span className={a.level_age_days >= 60 ? "text-accent font-bold" : ""}>{a.level_age_days}d</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted text-[10px]">{a.regime ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted text-[10px] max-w-[150px] truncate">{a.m7_verdict ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !loading && meta && (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted">
              <p className="text-sm tracking-widest font-bold">SIN ALERTAS</p>
              <p className="text-xs opacity-60">Ningun ticker dentro de ${threshold} de un nivel confirmado hace {minAge}+ dias</p>
            </div>
          )
        )}

      </div>
    </div>
  );
}
