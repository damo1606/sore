"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_WATCHLIST, LISTA_1, LISTA_2, LISTA_3, LIST_LABELS, LIST_COLORS, type WatchlistTicker } from "@/lib/watchlist";

interface LivePrice {
  price:     number;
  change:    number;
  changePct: number;
}

const REFRESH_INTERVAL = 30000; // 30 segundos

interface ProximityAlert {
  ticker:         string;
  spot_current:   number;
  level:          number;
  level_type:     "support" | "resistance";
  module:         string;
  distance_usd:   number;
  distance_pct:   number;
  threshold_pct:  number;
  atr14:          number | null;
  level_age_days: number;
  regime:         string | null;
  m7_verdict:     string | null;
  snapshot_date:  string;
}

interface ScanMeta {
  tickers_scanned: number;
  prices_fetched:  number;
  min_age_days:    number;
  cutoff_date:     string;
}

interface Opportunity {
  ticker:         string;
  spot:           number;
  level:          number;
  level_type:     "support" | "resistance";
  module:         string;
  distance_pct:   number;
  threshold_pct:  number;
  probability:    number;
  confidence:     "ALTA" | "MEDIA" | "BAJA";
  direction:      "LONG" | "SHORT";
  entry:          number;
  stop:           number;
  target:         number;
  rr_ratio:       number;
  regime:         string;
  vix:            number | null;
  fear_score:     number | null;
  fear_label:     string | null;
  level_age_days: number;
  macro_source:   string;
  backtest_used:  boolean;
}

interface BatchState {
  running:   boolean;
  total:     number;
  done:      number;
  current:   string;
  errors:    string[];
  completed: string[];
}

// distPct = distancia actual en %, threshPct = zona dinámica en %
function DistanceBar({ distPct, threshPct }: { distPct: number; threshPct: number }) {
  const fill  = Math.min(100, (distPct / threshPct) * 100);
  const ratio = distPct / threshPct;
  const color = ratio < 0.25 ? "#ef4444" : ratio < 0.6 ? "#f59e0b" : "#22c55e";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-surface rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${fill}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono font-bold text-[11px]" style={{ color }}>{distPct.toFixed(2)}%</span>
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
  const [minAge,       setMinAge]       = useState(0);
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
  const [livePrices,    setLivePrices]    = useState<Record<string, LivePrice>>({});
  const [pricesAge,     setPricesAge]     = useState<string | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [opps,          setOpps]          = useState<Opportunity[]>([]);
  const [oppsLoading,   setOppsLoading]   = useState(false);
  const [oppsError,     setOppsError]     = useState("");
  const [minProb,       setMinProb]       = useState(45);
  const [dirFilter,     setDirFilter]     = useState<"ALL" | "LONG" | "SHORT">("ALL");
  const [customTicker,  setCustomTicker]  = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customError,   setCustomError]   = useState("");
  const [customOpps,    setCustomOpps]    = useState<Opportunity[]>([]);
  const [customAnalyzed,setCustomAnalyzed]= useState(false);
  const [customStep,    setCustomStep]    = useState<"idle" | "analyzing" | "scanning">("idle");
  const stopRef     = useRef(false);
  const refreshRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const watchlistTickers = DEFAULT_WATCHLIST.map((w) => w.ticker);

  // ── Precios en vivo (30s refresh) ──────────────────────────────────────────
  const fetchLivePrices = useCallback(async () => {
    setPricesLoading(true);
    try {
      // Yahoo Finance acepta hasta 100 símbolos por llamada
      const symbols = watchlistTickers.join(",");
      const res  = await fetch(`/api/scanner/prices?tickers=${symbols}`);
      const json = await res.json();
      if (res.ok && json.prices) {
        setLivePrices(json.prices);
        setPricesAge(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      }
    } catch {}
    setPricesLoading(false);
  }, []);

  // ── Cargar estado de análisis (qué tickers ya tienen snapshot) ──────────────
  const loadStatus = useCallback(async () => {
    try {
      const res  = await fetch(`/api/watchlist/status?tickers=${watchlistTickers.join(",")}`);
      const json = await res.json();
      setAnalyzedSet(new Set<string>(json.analyzed ?? []));
    } catch {}
  }, []);

  // ── Ticker personalizado ────────────────────────────────────────────────────
  const runCustomTicker = useCallback(async () => {
    const tk = customTicker.trim().toUpperCase();
    if (!tk) return;
    setCustomLoading(true);
    setCustomError("");
    setCustomOpps([]);
    setCustomAnalyzed(false);
    try {
      setCustomStep("analyzing");
      const a7 = await fetch(`/api/analysis7?ticker=${tk}`);
      if (!a7.ok) {
        const j = await a7.json().catch(() => ({}));
        throw new Error(j.error ?? `Error al analizar ${tk}`);
      }
      setCustomStep("scanning");
      const sc = await fetch(`/api/scanner/opportunities?tickers=${tk}&min_probability=${minProb}`);
      const sj = await sc.json();
      setCustomOpps(sj.opportunities ?? []);
      setCustomAnalyzed(true);
    } catch (e: any) { setCustomError(e.message); }
    setCustomStep("idle");
    setCustomLoading(false);
  }, [customTicker, minProb]);

  // ── Scanner 2: oportunidades inteligentes ──────────────────────────────────
  const runOpps = useCallback(async () => {
    setOppsLoading(true);
    setOppsError("");
    try {
      const res  = await fetch(`/api/scanner/opportunities?tickers=${watchlistTickers.join(",")}&min_probability=${minProb}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al escanear");
      setOpps(json.opportunities ?? []);
    } catch (e: any) { setOppsError(e.message); }
    setOppsLoading(false);
  }, [minProb]);

  // ── Scanner de proximidad ───────────────────────────────────────────────────
  const runScan = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/scanner/proximity?min_age_days=${minAge}&tickers=${watchlistTickers.join(",")}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al escanear");
      setAlerts(json.alerts ?? []);
      setMeta({ tickers_scanned: json.tickers_scanned, prices_fetched: json.prices_fetched, min_age_days: json.min_age_days, cutoff_date: json.cutoff_date });
      setLastScan(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [minAge]);

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
    loadStatus().then(() => { runScan(); runOpps(); });
    fetchLivePrices();
    refreshRef.current = setInterval(fetchLivePrices, REFRESH_INTERVAL);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, []);

  const pendingList  = DEFAULT_WATCHLIST.filter((w) => !analyzedSet.has(w.ticker));
  const pendingCount = pendingList.length;

  const filtered = alerts.filter((a) => {
    if (typeFilter !== "ALL" && a.level_type !== typeFilter) return false;
    if (moduleFilter !== "ALL" && a.module !== moduleFilter) return false;
    if (listFilter !== 0 && DEFAULT_WATCHLIST.find((w) => w.ticker === a.ticker)?.list !== listFilter) return false;
    return true;
  });

  // Crítica: distancia < 25% del threshold dinámico; advertencia: < 60%
  const criticalCount = alerts.filter((a) => a.distance_pct < a.threshold_pct * 0.25).length;
  const warningCount  = alerts.filter((a) => a.distance_pct >= a.threshold_pct * 0.25 && a.distance_pct < a.threshold_pct * 0.6).length;
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

      {/* Strip de precios en vivo — tooltip explicativo */}
      <div title="Precios de los 37 tickers actualizados cada 30 segundos desde Yahoo Finance. Verde ▲ = sube hoy, Rojo ▼ = baja hoy. Delay aproximado de 15 minutos (API gratuita). Scroll horizontal para ver todos." className="border-b border-border bg-surface overflow-hidden cursor-help">
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide px-2 py-1.5">
          {pricesAge && (
            <span className="text-[9px] text-muted tracking-widest shrink-0 mr-3 border-r border-border pr-3">
              {pricesLoading ? "↻" : "●"} {pricesAge}
            </span>
          )}
          {DEFAULT_WATCHLIST.map((w) => {
            const p = livePrices[w.ticker];
            if (!p) return (
              <div key={w.ticker} className="shrink-0 px-3 py-0.5 border-r border-border/30">
                <span className="text-[10px] font-bold text-muted/40 tracking-widest">{w.ticker}</span>
              </div>
            );
            const up = p.change >= 0;
            return (
              <div key={w.ticker} className="shrink-0 px-3 py-0.5 border-r border-border/30 flex items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-widest text-muted">{w.ticker}</span>
                <span className="text-[11px] font-mono font-bold text-text">${p.price.toFixed(2)}</span>
                <span className={`text-[9px] font-mono ${up ? "text-accent" : "text-danger"}`}>
                  {up ? "▲" : "▼"}{Math.abs(p.changePct).toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Título */}
        <div>
          <h1 className="text-2xl font-black tracking-[0.3em] text-accent mb-1">SCANNER DE PROXIMIDAD</h1>
          <p className="text-xs text-muted tracking-widest">37 tickers · 3 listas · niveles S/R confirmados · umbral dinamico por ATR</p>
        </div>

        {/* Batch Analyzer */}
        <div className="bg-card border border-border p-4 space-y-3">
          {/* Resumen explicativo */}
          <div className="border-l-2 border-accent/40 pl-3 space-y-0.5 mb-1">
            <p className="text-[10px] text-muted leading-relaxed">
              <span className="text-text font-bold">Que hace:</span> Corre el analisis M7 completo para cada ticker pendiente de forma automatica.
            </p>
            <p className="text-[10px] text-muted leading-relaxed">
              <span className="text-text font-bold">Por que importa:</span> Sin analisis previo no hay niveles S/R guardados — el scanner no tiene datos que comparar.
            </p>
            <p className="text-[10px] text-muted leading-relaxed">
              <span className="text-text font-bold">Como funciona:</span> Procesa 3 tickers a la vez con pausa de 1.2s entre lotes para no saturar Yahoo Finance.
            </p>
            <p className="text-[10px] text-muted leading-relaxed">
              <span className="text-text font-bold">Colores:</span> Gris = sin analisis · Blanco = analizado · Naranja con punto = tiene alerta activa · Parpadeando = en proceso ahora.
            </p>
            <p className="text-[10px] text-muted leading-relaxed">
              <span className="text-text font-bold">Cuando repetir:</span> Semanalmente o antes de cada sesion para que los niveles reflejen el GEX actual del mercado.
            </p>
          </div>
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
          <div className="border-l-2 border-indigo-500/40 pl-3 space-y-0.5">
            <p className="text-[10px] text-muted"><span className="text-text font-bold">Watchlist de 37 tickers:</span> organizados en 3 listas segun su perfil de negociacion.</p>
            <p className="text-[10px] text-muted"><span className="text-indigo-400 font-bold">L1 Rotacion:</span> 13 ETFs sectoriales — sirven para ver hacia donde fluye el capital institucional entre sectores.</p>
            <p className="text-[10px] text-muted"><span className="text-warning font-bold">L2 Prima:</span> 12 acciones con mayor prima de opciones — maxima liquidez para estrategias de volatilidad.</p>
            <p className="text-[10px] text-muted"><span className="text-accent font-bold">L3 Liquidez:</span> 12 tickers con spread mas ajustado — ETFs base + acciones con mayor profundidad de libro.</p>
            <p className="text-[10px] text-muted"><span className="text-text font-bold">Click en cualquier ticker</span> para ir directo al analisis M7. Naranja con punto = precio cerca de un nivel confirmado.</p>
          </div>
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
            <p className="text-[9px] text-muted tracking-widest font-bold">UMBRAL DINAMICO · max(1.5%, 0.5×ATR/spot)</p>
            <p className="text-[10px] text-muted">Cada ticker tiene su propia zona segun su volatilidad. KO ~$0.90, NVDA ~$17, TSLA ~$9</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-[9px] text-muted tracking-widest font-bold">ANTIGUEDAD MINIMA DEL NIVEL</p>
            <div className="flex items-center gap-2 flex-wrap">
              {[0, 1, 7, 14, 30, 45, 60, 90].map((v) => (
                <button key={v} onClick={() => setMinAge(v)} className={`text-xs px-3 py-1.5 border tracking-widest transition-colors ${minAge === v ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
                  {v === 0 ? "HOY" : `${v}d`}
                </button>
              ))}
            </div>
          </div>

          <button onClick={runScan} disabled={loading || batch.running} className="bg-accent text-white px-6 py-2.5 text-sm font-bold tracking-widest hover:opacity-80 disabled:opacity-40 transition-opacity">
            {loading ? "ESCANEANDO..." : "ESCANEAR"}
          </button>

          {lastScan && !loading && (
            <p className="text-[10px] text-muted self-center">ultimo scan: {lastScan}</p>
          )}
        </div>

        {error && <div className="border border-danger text-danger text-sm p-3 tracking-widest">{error}</div>}

        {/* Resumen */}
        {meta && (
          <div className="space-y-3">
          <div className="border-l-2 border-warning/40 pl-3 space-y-0.5">
            <p className="text-[10px] text-muted"><span className="text-text font-bold">Tickers con datos:</span> cuantos de los 37 tienen snapshots de mas de {meta.min_age_days} dias — solo estos se incluyen en el scan.</p>
            <p className="text-[10px] text-muted"><span className="text-text font-bold">Alertas totales:</span> niveles donde el precio actual entro dentro de la zona ATR dinamica de ese ticker.</p>
            <p className="text-[10px] text-muted"><span className="text-danger font-bold">Criticas:</span> precio dentro del 25% interior de la zona — puede testear el nivel en horas o minutos.</p>
            <p className="text-[10px] text-muted"><span className="text-warning font-bold">Advertencia:</span> precio entre el 25% y 60% de la zona — en orbita del nivel, atencion en la sesion.</p>
            <p className="text-[10px] text-muted"><span className="text-text font-bold">Verde:</span> precio detectado en la zona pero con margen — nivel relevante pero sin urgencia inmediata.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-border p-4 space-y-1">
              <p className="text-[9px] text-muted tracking-widest font-bold">TICKERS CON DATOS</p>
              <p className="text-2xl font-black font-mono text-text">{meta.tickers_scanned}<span className="text-sm text-muted font-normal"> / 37</span></p>
              <p className="text-[10px] text-muted">con niveles &gt;{meta.min_age_days}d</p>
            </div>
            <div className="bg-card border border-border p-4 space-y-1">
              <p className="text-[9px] text-muted tracking-widest font-bold">ALERTAS TOTALES</p>
              <p className={`text-2xl font-black font-mono ${alerts.length > 0 ? "text-warning" : "text-muted"}`}>{alerts.length}</p>
              <p className="text-[10px] text-muted">umbral dinamico ATR</p>
            </div>
            <div className="bg-card border border-border p-4 space-y-1">
              <p className="text-[9px] text-muted tracking-widest font-bold">CRITICAS</p>
              <p className={`text-2xl font-black font-mono ${criticalCount > 0 ? "text-danger" : "text-muted"}`}>{criticalCount}</p>
              <p className="text-[10px] text-muted">dentro del 25% de la zona ATR</p>
            </div>
            <div className="bg-card border border-border p-4 space-y-1">
              <p className="text-[9px] text-muted tracking-widest font-bold">ADVERTENCIA</p>
              <p className={`text-2xl font-black font-mono ${warningCount > 0 ? "text-warning" : "text-muted"}`}>{warningCount}</p>
              <p className="text-[10px] text-muted">entre 25% y 60% de la zona</p>
            </div>
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
        {filtered.length > 0 && (
          <div className="border-l-2 border-accent/40 pl-3 space-y-0.5">
            <p className="text-[10px] text-muted"><span className="text-text font-bold">Tabla de alertas:</span> cada fila es un nivel S/R confirmado que el precio actual esta cerca de tocar.</p>
            <p className="text-[10px] text-muted"><span className="text-text font-bold">DISTANCIA:</span> barra que muestra que tan dentro de la zona ATR esta el precio — llena y roja significa que casi toca el nivel.</p>
            <p className="text-[10px] text-muted"><span className="text-text font-bold">ZONA ATR:</span> porcentaje que define el radio de alerta para ese ticker especifico — calculado con su volatilidad real.</p>
            <p className="text-[10px] text-muted"><span className="text-text font-bold">EDAD NIVEL:</span> hace cuantos dias se identifico ese strike — niveles de mas de 60 dias (en azul) son los mas confirmados.</p>
            <p className="text-[10px] text-muted"><span className="text-text font-bold">VEREDICTO M7:</span> la direccion que el modelo preveia cuando se identifico el nivel — ayuda a saber si es soporte o resistencia clave.</p>
          </div>
        )}
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
                  <th className="px-3 py-3">ZONA ATR</th>
                  <th className="px-3 py-3">ATR14</th>
                  <th className="px-3 py-3">EDAD · CONFIANZA</th>
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
                      <td className="px-3 py-2.5"><DistanceBar distPct={a.distance_pct} threshPct={a.threshold_pct} /></td>
                      <td className="px-3 py-2.5 font-mono text-muted text-[10px]">{a.threshold_pct.toFixed(2)}%</td>
                      <td className="px-3 py-2.5 font-mono text-muted text-[10px]">{a.atr14 != null ? `$${a.atr14.toFixed(2)}` : <span className="italic opacity-50">sin data</span>}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted text-[10px]">{a.level_age_days}d</span>
                          {a.level_age_days < 7
                            ? <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-warning/20 text-warning tracking-widest">NUEVO</span>
                            : a.level_age_days < 30
                            ? <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 tracking-widest">RECIENTE</span>
                            : <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent tracking-widest">CONFIRMADO</span>
                          }
                        </div>
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
              <p className="text-xs opacity-60">Ningun ticker dentro de su zona ATR dinamica · niveles con {minAge}+ dias de antiguedad</p>
            </div>
          )
        )}

        {/* ── SCANNER 2: OPORTUNIDADES INTELIGENTES ─────────────────────────── */}
        <div className="space-y-4 pt-4 border-t border-border">

          {/* Título */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-black tracking-[0.3em] text-accent">SCANNER</h2>
              <p className="text-xs text-muted tracking-widest mt-0.5">oportunidades filtradas por regimen · VIX · probabilidad · con estructura de trade</p>
            </div>
            <button
              onClick={runOpps}
              disabled={oppsLoading}
              className="bg-accent text-white px-5 py-2 text-xs font-bold tracking-widest hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {oppsLoading ? "ESCANEANDO..." : "ESCANEAR"}
            </button>
          </div>

          {/* Buscador ticker personalizado */}
          <div className="bg-surface border border-border p-4 space-y-3">
            <p className="text-[9px] text-muted tracking-widest font-bold">BUSCAR TICKER PERSONALIZADO</p>
            <p className="text-[10px] text-muted">Analiza cualquier ticker de US equity que no este en los 37 — corre M7 completo y muestra oportunidades</p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={customTicker}
                onChange={(e) => { setCustomTicker(e.target.value.toUpperCase()); setCustomAnalyzed(false); setCustomOpps([]); setCustomError(""); }}
                onKeyDown={(e) => e.key === "Enter" && !customLoading && runCustomTicker()}
                placeholder="Ej. ORCL, UBER, SHOP..."
                maxLength={10}
                className="bg-card border border-border text-text font-mono font-bold text-sm px-4 py-2 tracking-widest placeholder:text-muted/40 focus:outline-none focus:border-accent w-44"
              />
              <button
                onClick={runCustomTicker}
                disabled={customLoading || !customTicker.trim()}
                className="bg-accent text-white px-5 py-2 text-xs font-bold tracking-widest hover:opacity-80 disabled:opacity-40 transition-opacity"
              >
                {customLoading
                  ? customStep === "analyzing" ? "ANALIZANDO M7..." : "ESCANEANDO..."
                  : "ANALIZAR"}
              </button>
              {customAnalyzed && !customLoading && (
                <span className="text-[10px] text-accent font-bold tracking-widest">
                  {customOpps.length > 0 ? `${customOpps.length} oportunidad${customOpps.length > 1 ? "es" : ""}` : "sin oportunidades con ese umbral"}
                </span>
              )}
            </div>
            {customError && <p className="text-[10px] text-danger">{customError}</p>}
            {customOpps.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {customOpps.map((o, i) => {
                  const isLong   = o.direction === "LONG";
                  const dirColor = isLong ? "#22c55e" : "#ef4444";
                  const probColor = o.probability >= 65 ? "#22c55e" : o.probability >= 45 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={i} className="bg-card border border-accent/40 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <a href={`/?ticker=${o.ticker}`} className="text-base font-black tracking-widest text-accent hover:underline">{o.ticker}</a>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-widest" style={{ color: dirColor, backgroundColor: `${dirColor}20` }}>{o.direction}</span>
                          <span className="text-[9px] text-muted">{o.module}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black font-mono" style={{ color: probColor }}>{o.probability}%</p>
                          <p className="text-[9px] tracking-widest font-bold" style={{ color: probColor }}>{o.confidence}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-text">${o.spot.toFixed(2)}</span>
                        <span className="text-muted">→</span>
                        <span className="font-mono text-muted">${o.level.toFixed(2)}</span>
                        <span className={`text-[9px] font-bold ${o.level_type === "support" ? "text-accent" : "text-danger"}`}>{o.level_type === "support" ? "SUP" : "RES"}</span>
                        <span className="ml-auto text-muted text-[10px]">{o.distance_pct.toFixed(2)}% dist</span>
                      </div>
                      <div className="h-1 bg-surface rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${o.probability}%`, backgroundColor: probColor }} />
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <div className="bg-surface p-1.5 rounded">
                          <p className="text-[8px] text-muted tracking-widest">ENTRY</p>
                          <p className="text-[11px] font-mono font-bold text-text">${o.entry.toFixed(2)}</p>
                        </div>
                        <div className="bg-surface p-1.5 rounded border border-danger/30">
                          <p className="text-[8px] text-danger tracking-widest">STOP</p>
                          <p className="text-[11px] font-mono font-bold text-danger">${o.stop.toFixed(2)}</p>
                        </div>
                        <div className="bg-surface p-1.5 rounded border border-accent/30">
                          <p className="text-[8px] text-accent tracking-widest">TARGET</p>
                          <p className="text-[11px] font-mono font-bold text-accent">${o.target.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted">
                        <span className="font-bold text-text">RR {o.rr_ratio.toFixed(1)}x</span>
                        <div className="flex items-center gap-2">
                          {o.vix != null && <span>VIX {o.vix.toFixed(1)}</span>}
                          <span className={`font-bold ${o.regime?.includes("COMP") ? "text-accent" : o.regime?.includes("TRANS") ? "text-warning" : "text-muted"}`}>{o.regime ?? "—"}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-muted border-t border-border pt-2">
                        <span>{o.level_age_days}d · {o.snapshot_date}</span>
                        <span className={o.macro_source === "FRED" ? "text-accent" : "text-muted"}>{o.macro_source}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="space-y-1">
              <p className="text-[9px] text-muted tracking-widest font-bold">PROBABILIDAD MINIMA</p>
              <div className="flex gap-1.5">
                {[40, 45, 55, 65].map((v) => (
                  <button key={v} onClick={() => setMinProb(v)} className={`text-xs px-3 py-1 border tracking-widest transition-colors ${minProb === v ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
                    {v}%+
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] text-muted tracking-widest font-bold">DIRECCION</p>
              <div className="flex gap-1.5">
                {(["ALL", "LONG", "SHORT"] as const).map((d) => (
                  <button key={d} onClick={() => setDirFilter(d)} className={`text-xs px-3 py-1 border tracking-widest transition-colors ${dirFilter === d ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {oppsError && <div className="border border-danger text-danger text-xs p-3 tracking-widest">{oppsError}</div>}

          {/* Cards de oportunidades */}
          {(() => {
            const filtered2 = opps.filter((o) => dirFilter === "ALL" || o.direction === dirFilter);
            if (!oppsLoading && filtered2.length === 0) return (
              <div className="flex flex-col items-center justify-center h-28 gap-2 text-muted border border-border">
                <p className="text-sm tracking-widest font-bold">SIN OPORTUNIDADES</p>
                <p className="text-xs opacity-60">ninguna alerta supera el umbral de probabilidad con regimen favorable</p>
              </div>
            );
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered2.map((o, i) => {
                  const isLong    = o.direction === "LONG";
                  const dirColor  = isLong ? "#22c55e" : "#ef4444";
                  const probColor = o.probability >= 65 ? "#22c55e" : o.probability >= 45 ? "#f59e0b" : "#ef4444";
                  const wl        = DEFAULT_WATCHLIST.find((w) => w.ticker === o.ticker);
                  return (
                    <div key={i} className="bg-card border border-border p-4 space-y-3 hover:border-accent/50 transition-colors">

                      {/* Header: ticker + dirección + P% */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <a href={`/?ticker=${o.ticker}`} className="text-base font-black tracking-widest text-accent hover:underline">{o.ticker}</a>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-widest" style={{ color: dirColor, backgroundColor: `${dirColor}20` }}>{o.direction}</span>
                          <span className="text-[9px] text-muted">{o.module}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black font-mono" style={{ color: probColor }}>{o.probability}%</p>
                          <p className="text-[9px] tracking-widest font-bold" style={{ color: probColor }}>{o.confidence}</p>
                        </div>
                      </div>

                      {/* Precio actual → nivel */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-text">${o.spot.toFixed(2)}</span>
                        <span className="text-muted">→</span>
                        <span className="font-mono text-muted">${o.level.toFixed(2)}</span>
                        <span className={`text-[9px] font-bold ${o.level_type === "support" ? "text-accent" : "text-danger"}`}>
                          {o.level_type === "support" ? "SUP" : "RES"}
                        </span>
                        <span className="ml-auto text-muted text-[10px]">{o.distance_pct.toFixed(2)}% dist</span>
                      </div>

                      {/* Barra de probabilidad */}
                      <div className="h-1 bg-surface rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${o.probability}%`, backgroundColor: probColor }} />
                      </div>

                      {/* Entry / Stop / Target */}
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <div className="bg-surface p-1.5 rounded">
                          <p className="text-[8px] text-muted tracking-widest">ENTRY</p>
                          <p className="text-[11px] font-mono font-bold text-text">${o.entry.toFixed(2)}</p>
                        </div>
                        <div className="bg-surface p-1.5 rounded border border-danger/30">
                          <p className="text-[8px] text-danger tracking-widest">STOP</p>
                          <p className="text-[11px] font-mono font-bold text-danger">${o.stop.toFixed(2)}</p>
                        </div>
                        <div className="bg-surface p-1.5 rounded border border-accent/30">
                          <p className="text-[8px] text-accent tracking-widest">TARGET</p>
                          <p className="text-[11px] font-mono font-bold text-accent">${o.target.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* RR + contexto macro */}
                      <div className="flex items-center justify-between text-[10px] text-muted">
                        <span className="font-bold text-text">RR {o.rr_ratio.toFixed(1)}x</span>
                        <div className="flex items-center gap-2">
                          {o.vix != null && <span>VIX {o.vix.toFixed(1)}</span>}
                          <span className={`font-bold ${
                            o.regime?.includes("COMP") ? "text-accent" :
                            o.regime?.includes("TRANS") ? "text-warning" : "text-muted"
                          }`}>{o.regime ?? "—"}</span>
                          {o.fear_label && <span className="text-[9px] opacity-70">{o.fear_label.split(" ")[0]}</span>}
                        </div>
                      </div>

                      {/* Footer: edad del nivel + fuente */}
                      <div className="flex items-center justify-between text-[9px] text-muted border-t border-border pt-2">
                        <span>{o.level_age_days}d · {o.snapshot_date}</span>
                        <div className="flex items-center gap-1.5">
                          {!o.backtest_used && <span className="text-warning">sin backtest</span>}
                          <span className={o.macro_source === "FRED" ? "text-accent" : "text-muted"}>{o.macro_source}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

      </div>
    </div>
  );
}
