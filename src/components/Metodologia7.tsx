"use client";

import { useState, useCallback, useEffect } from "react";
import type { Analysis7Result, SRCluster, TimingBlock, MethodologyContribution } from "@/lib/gex7";

// ─── ChartSummary ─────────────────────────────────────────────────────────────
function ChartSummary({ lines }: { lines: string[] }) {
  return (
    <div className="mt-5 border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-5 gap-2">
      {lines.map((line, i) => (
        <div key={i} className="text-xs text-muted leading-relaxed px-2 border-l-2 border-border">
          {line}
        </div>
      ))}
    </div>
  );
}

// ─── ScoreBar −100/+100 ───────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const pct = Math.abs(score) / 2; // 0-50%
  const isPositive = score >= 0;
  return (
    <div className="w-full h-3 bg-surface rounded-full relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-px h-full bg-border z-10" />
      </div>
      <div
        className={`absolute top-0 h-full ${isPositive ? "bg-accent left-1/2" : "bg-danger right-1/2"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Contribution row ─────────────────────────────────────────────────────────
function ContributionRow({ c }: { c: MethodologyContribution }) {
  const isPositive = c.rawScore >= 0;
  const barPct = Math.abs(c.rawScore) / 2;
  return (
    <div className="flex flex-col gap-1 py-2 border-b border-border last:border-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-muted w-6">{c.id}</span>
          <span className="text-xs text-foreground truncate">{c.name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted">{Math.round(c.weight * 100)}%</span>
          <span className={`text-xs font-mono font-bold w-10 text-right ${isPositive ? "text-accent" : "text-danger"}`}>
            {c.rawScore > 0 ? "+" : ""}{Math.round(c.rawScore)}
          </span>
          <span className={`text-xs font-mono w-12 text-right ${c.contribution > 0 ? "text-accent" : "text-danger"}`}>
            {c.contribution > 0 ? "+" : ""}{c.contribution.toFixed(1)}pts
          </span>
        </div>
      </div>
      <div className="w-full h-1.5 bg-surface rounded-full relative overflow-hidden">
        <div className="absolute inset-0 flex items-center">
          <div className="w-px h-full bg-border mx-auto" style={{ marginLeft: "50%" }} />
        </div>
        <div
          className={`absolute top-0 h-full rounded-full ${isPositive ? "bg-accent left-1/2" : "bg-danger right-1/2"}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      <p className="text-xs text-muted opacity-70 leading-relaxed">{c.label}</p>
    </div>
  );
}

// ─── Calificación mini-bar ────────────────────────────────────────────────────
function CalifBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-accent" : value >= 45 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono">{value}%</span>
      <div className="w-12 h-1.5 bg-surface rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ─── Timing signal badge ──────────────────────────────────────────────────────
function SignalBadge({ signal }: { signal: TimingBlock["signal"] }) {
  const colors: Record<string, string> = {
    ALCISTA:    "bg-accent/20 text-accent border-accent",
    BAJISTA:    "bg-danger/20 text-danger border-danger",
    NEUTRAL:    "bg-border/40 text-muted border-border",
    "NO OPERAR": "bg-danger/10 text-danger border-danger/50",
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${colors[signal] ?? colors["NEUTRAL"]}`}>
      {signal}
    </span>
  );
}

// ─── Verdict color helpers ────────────────────────────────────────────────────
function verdictColor(v: string) {
  return v === "ALCISTA" ? "text-accent" : v === "BAJISTA" ? "text-danger" : "text-warning";
}
function verdictBorder(v: string) {
  return v === "ALCISTA" ? "border-accent" : v === "BAJISTA" ? "border-danger" : "border-warning";
}

// ─── PRIMARY SETUP CARD ───────────────────────────────────────────────────────
function PrimarySetupCard({
  cluster,
  type,
  spot,
}: {
  cluster: SRCluster | null;
  type: "long" | "short";
  spot: number;
}) {
  const isLong = type === "long";
  const borderColor = isLong ? "border-accent" : "border-danger";
  const textColor   = isLong ? "text-accent"   : "text-danger";
  const label       = isLong ? "PRIMARY LONG · SOPORTE INSTITUCIONAL" : "PRIMARY SHORT · RESISTENCIA INSTITUCIONAL";

  if (!cluster) {
    return (
      <div className={`bg-card border border-border border-t-4 ${borderColor} p-6 flex flex-col items-center justify-center min-h-[180px]`}>
        <p className="text-xs text-muted tracking-widest">{label}</p>
        <p className="text-sm text-muted mt-2 opacity-50">Sin nivel disponible</p>
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border border-t-4 ${borderColor} p-6 space-y-4`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-bold tracking-widest ${textColor}`}>{label}</p>
        <span className={`text-xs px-2 py-0.5 border ${borderColor} ${textColor} font-bold`}>
          {cluster.votes}/4 METODOLOGÍAS
        </span>
      </div>

      <div className={`text-5xl font-black font-mono ${textColor}`}>
        ${cluster.strike.toFixed(2)}
      </div>
      <p className="text-xs text-muted">
        {cluster.distPct > 0 ? "+" : ""}{cluster.distPct.toFixed(2)}% desde spot
      </p>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <div>
          <p className="text-muted">ENTRY</p>
          <p className="font-mono text-foreground">${cluster.entryPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-muted">STOP</p>
          <p className="font-mono text-danger">${cluster.stopPrice.toFixed(2)}</p>
        </div>
        {cluster.targetPrice && (
          <div>
            <p className="text-muted">TARGET</p>
            <p className="font-mono text-accent">${cluster.targetPrice.toFixed(2)}</p>
          </div>
        )}
        {cluster.rrRatio && (
          <div>
            <p className="text-muted">R/R</p>
            <p className="font-mono text-foreground">{cluster.rrRatio}:1</p>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">CALIFICACIÓN</span>
          <CalifBar value={cluster.calificacion} />
        </div>
        <p className="text-xs text-muted">Fuentes: {cluster.sources.join(" · ")}</p>
      </div>
    </div>
  );
}

// ─── Timing row (desktop table) ───────────────────────────────────────────────
function TimingRow({ block }: { block: TimingBlock }) {
  const isNoOp = block.signal === "NO OPERAR";
  return (
    <tr className={`border-b border-border text-xs ${isNoOp ? "opacity-50" : ""}`}>
      <td className="py-3 px-3 font-bold text-foreground whitespace-nowrap">{block.timeframe}</td>
      <td className="py-3 px-3"><SignalBadge signal={block.signal} /></td>
      <td className="py-3 px-3 font-mono">{block.entry ? `$${block.entry.toFixed(2)}` : "—"}</td>
      <td className="py-3 px-3 font-mono text-accent">{block.target ? `$${block.target.toFixed(2)}` : "—"}</td>
      <td className="py-3 px-3 font-mono text-danger">{block.stop ? `$${block.stop.toFixed(2)}` : "—"}</td>
      <td className="py-3 px-3 font-mono">{block.rrRatio ?? "—"}</td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 bg-surface rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${block.conviction}%` }} />
          </div>
          <span className="text-muted">{block.conviction}%</span>
        </div>
      </td>
      <td className="py-3 px-3 text-muted max-w-[200px] truncate">{block.basis}</td>
    </tr>
  );
}

// ─── Timing card (mobile) ─────────────────────────────────────────────────────
function TimingCard({ block }: { block: TimingBlock }) {
  return (
    <div className="bg-card border border-border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">{block.timeframe}</span>
        <SignalBadge signal={block.signal} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div><p className="text-muted">ENTRY</p><p className="font-mono">{block.entry ? `$${block.entry.toFixed(2)}` : "—"}</p></div>
        <div><p className="text-muted">TARGET</p><p className="font-mono text-accent">{block.target ? `$${block.target.toFixed(2)}` : "—"}</p></div>
        <div><p className="text-muted">STOP</p><p className="font-mono text-danger">{block.stop ? `$${block.stop.toFixed(2)}` : "—"}</p></div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">R/R {block.rrRatio ?? "—"} · Convicción {block.conviction}%</span>
      </div>
      <p className="text-xs text-muted opacity-70">{block.condition}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Metodologia7({
  ticker,
  expiration,
  analyzeKey,
  companyName = "",
}: {
  ticker: string;
  expiration: string;
  analyzeKey: number;
  companyName?: string;
}) {
  const [data, setData] = useState<Analysis7Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAnalysis = useCallback(async (t: string, exp: string) => {
    setLoading(true);
    setError("");
    try {
      const url = exp
        ? `/api/analysis7?ticker=${t}&upTo=${exp}`
        : `/api/analysis7?ticker=${t}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al obtener análisis M7");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (analyzeKey > 0 && ticker) fetchAnalysis(ticker, expiration);
  }, [analyzeKey]);

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="mx-6 mt-4 p-4 border border-danger text-danger text-sm">{error}</div>
  );

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!data && !loading) return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-4 text-muted">
      <div className="text-5xl">🏆</div>
      <p className="text-base tracking-widest font-bold">METODOLOGÍA 7</p>
      <p className="text-sm opacity-60">VEREDICTO FINAL CONSOLIDADO · S/R INSTITUCIONAL · TIMING MULTI-MARCO</p>
      <p className="text-xs opacity-40 mt-2">Ingresa un ticker y presiona ANALIZAR</p>
      <div className="flex gap-3 text-xs opacity-30 mt-1">
        {["SPY", "QQQ", "AAPL", "NVDA", "TSLA"].map((s) => (
          <span key={s} className="border border-border px-2 py-1">{s}</span>
        ))}
      </div>
    </div>
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
      <div className="w-10 h-10 border-4 border-accent border-t-transparent animate-spin rounded-full" />
      <p className="text-sm text-muted tracking-widest">CALCULANDO VEREDICTO FINAL...</p>
      <p className="text-xs text-muted opacity-50">Agregando M1 · M2 · M3 · M5 · M6</p>
    </div>
  );

  if (!data) return null;

  const vc = verdictColor(data.finalVerdict);
  const vb = verdictBorder(data.finalVerdict);

  return (
    <main className="p-6 space-y-6">

      {/* ── SECCIÓN 1: VEREDICTO FINAL HERO ──────────────────────────────── */}
      <section className={`bg-card border-2 ${vb} p-6 sm:p-8 space-y-6`}>

        {/* Suspended banner */}
        {data.signalSuspended && (
          <div className="border border-danger bg-danger/10 text-danger text-xs p-3 flex items-start gap-2">
            <span className="font-bold shrink-0">⚠ SEÑALES GEX SUSPENDIDAS</span>
            <span>{data.suspendedReason}</span>
          </div>
        )}

        {/* Métricas principales */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-muted tracking-widest mb-1">VEREDICTO FINAL</p>
            <p className={`text-4xl sm:text-5xl font-black ${vc}`}>{data.finalVerdict}</p>
          </div>
          <div>
            <p className="text-xs text-muted tracking-widest mb-1">SCORE M7</p>
            <p className={`text-4xl sm:text-5xl font-black font-mono ${vc}`}>
              {data.finalScore > 0 ? "+" : ""}{data.finalScore}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted tracking-widest mb-1">CONFIANZA</p>
            <p className="text-4xl sm:text-5xl font-black text-foreground">{data.confidence}%</p>
          </div>
          <div>
            <p className="text-xs text-muted tracking-widest mb-1">SPOT</p>
            <p className="text-4xl sm:text-5xl font-black font-mono text-foreground">${data.spot.toFixed(2)}</p>
          </div>
        </div>

        {/* Sub-métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="bg-surface p-3">
            <p className="text-xs text-muted">RÉGIMEN M6</p>
            <p className="font-bold text-foreground mt-0.5">{data.m6Regime}</p>
          </div>
          <div className="bg-surface p-3">
            <p className="text-xs text-muted">VIX · VELOCIDAD</p>
            <p className="font-bold font-mono text-foreground mt-0.5">{data.m6Vix.toFixed(1)} · {data.m6VixVelocity}</p>
          </div>
          <div className="bg-surface p-3">
            <p className="text-xs text-muted">FEAR & GREED</p>
            <p className={`font-bold mt-0.5 ${data.m6FearScore <= 40 ? "text-danger" : data.m6FearScore >= 60 ? "text-accent" : "text-warning"}`}>
              {data.m6FearScore} — {data.m6FearLabel}
            </p>
          </div>
          <div className="bg-surface p-3">
            <p className="text-xs text-muted">MULTIPLICADOR RÉGIMEN</p>
            <p className="font-bold font-mono text-foreground mt-0.5">×{data.regimeMultiplier.toFixed(1)}</p>
          </div>
        </div>

        {/* Score bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted">
            <span>BAJISTA −100</span>
            <span>NEUTRAL 0</span>
            <span>ALCISTA +100</span>
          </div>
          <ScoreBar score={data.finalScore} />
        </div>

        {/* Contribuciones por metodología */}
        <div>
          <p className="text-xs text-muted tracking-widest mb-3">CONTRIBUCIONES POR METODOLOGÍA</p>
          <div className="divide-y divide-border">
            {data.contributions.map((c) => (
              <ContributionRow key={c.id} c={c} />
            ))}
          </div>
        </div>

        <ChartSummary lines={data.summaryLines} />
      </section>

      {/* ── SECCIÓN 2: PRIMARY TRADE SETUPS ──────────────────────────────── */}
      <section>
        <p className="text-xs text-muted tracking-widest mb-3">PRIMARY TRADE SETUPS — NIVELES DE MAYOR CONVICCIÓN INSTITUCIONAL</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PrimarySetupCard cluster={data.primaryLong}  type="long"  spot={data.spot} />
          <PrimarySetupCard cluster={data.primaryShort} type="short" spot={data.spot} />
        </div>
      </section>

      {/* ── SECCIÓN 3: TABLA INSTITUCIONAL S/R ───────────────────────────── */}
      <section className="bg-card border border-border p-6">
        <p className="text-xs text-muted tracking-widest mb-4">
          TABLA INSTITUCIONAL DE SOPORTES Y RESISTENCIAS — TODOS LOS MODELOS CONSOLIDADOS
        </p>

        {data.srTable.length === 0 ? (
          <p className="text-sm text-muted">Sin niveles institucionales detectados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="text-left py-2 px-3">STRIKE</th>
                  <th className="text-left py-2 px-3">TIPO</th>
                  <th className="text-right py-2 px-3">DIST%</th>
                  <th className="text-right py-2 px-3">PROB</th>
                  <th className="text-right py-2 px-3">VOTOS</th>
                  <th className="text-right py-2 px-3">GEX</th>
                  <th className="text-left py-2 px-3">CALIFICACIÓN</th>
                  <th className="text-left py-2 px-3">FUENTES</th>
                </tr>
              </thead>
              <tbody>
                {data.srTable.map((cluster, i) => {
                  const isPrimaryLong  = data.primaryLong?.strike  === cluster.strike && cluster.type === "support";
                  const isPrimaryShort = data.primaryShort?.strike === cluster.strike && cluster.type === "resistance";
                  const rowBg = cluster.type === "support"
                    ? "bg-accent/5 hover:bg-accent/10"
                    : "bg-danger/5 hover:bg-danger/10";
                  return (
                    <tr key={i} className={`border-b border-border transition-colors ${rowBg}`}>
                      <td className="py-2 px-3 font-mono font-bold">
                        ${cluster.strike.toFixed(2)}
                        {isPrimaryLong  && <span className="ml-2 text-accent font-bold">LONG ★</span>}
                        {isPrimaryShort && <span className="ml-2 text-danger font-bold">SHORT ★</span>}
                      </td>
                      <td className={`py-2 px-3 font-bold ${cluster.type === "support" ? "text-accent" : "text-danger"}`}>
                        {cluster.type === "support" ? "SOPORTE" : "RESIST."}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono ${cluster.distPct < 0 ? "text-accent" : "text-danger"}`}>
                        {cluster.distPct > 0 ? "+" : ""}{cluster.distPct.toFixed(2)}%
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{cluster.probability}%</td>
                      <td className="py-2 px-3 text-right font-mono">{cluster.votes}/4</td>
                      <td className="py-2 px-3 text-right font-mono text-muted">{(cluster.gexWeight * 100).toFixed(0)}%</td>
                      <td className="py-2 px-3"><CalifBar value={cluster.calificacion} /></td>
                      <td className="py-2 px-3 text-muted">{cluster.sources.join(" · ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── SECCIÓN 4: TIMING MATRIX ─────────────────────────────────────── */}
      <section className="bg-card border border-border p-6">
        <p className="text-xs text-muted tracking-widest mb-4">
          TIMING MULTI-MARCO — ENTRADA · OBJETIVO · STOP · R/R
        </p>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="text-left py-2 px-3">MARCO</th>
                <th className="text-left py-2 px-3">SEÑAL</th>
                <th className="text-left py-2 px-3">ENTRY</th>
                <th className="text-left py-2 px-3">TARGET</th>
                <th className="text-left py-2 px-3">STOP</th>
                <th className="text-left py-2 px-3">R/R</th>
                <th className="text-left py-2 px-3">CONVICTION</th>
                <th className="text-left py-2 px-3">BASE</th>
              </tr>
            </thead>
            <tbody>
              {data.timingMatrix.map((block) => (
                <TimingRow key={block.timeframe} block={block} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-3">
          {data.timingMatrix.map((block) => (
            <TimingCard key={block.timeframe} block={block} />
          ))}
        </div>

        {/* Condiciones detalladas */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.timingMatrix.map((block) => (
            <div key={block.timeframe} className="text-xs text-muted border-l-2 border-border pl-3">
              <span className="font-bold text-foreground">{block.timeframe}</span>
              {" — "}{block.condition}
            </div>
          ))}
        </div>
      </section>

      {/* ── SECCIÓN 5: RESUMEN FINAL ──────────────────────────────────────── */}
      <section className="bg-card border border-border p-6">
        <p className="text-xs text-muted tracking-widest mb-2">
          RESUMEN FINAL — ANÁLISIS INSTITUCIONAL COMPLETO · {data.ticker} · ${data.spot.toFixed(2)}
        </p>
        <ChartSummary lines={data.summaryLines} />
      </section>

    </main>
  );
}
