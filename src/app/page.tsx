"use client";

import { useState } from "react";
import Metodologia1 from "@/components/Metodologia1";
import Metodologia2 from "@/components/Metodologia2";
import Metodologia3 from "@/components/Metodologia3";
import Metodologia4 from "@/components/Metodologia4";
import Metodologia5 from "@/components/Metodologia5";
import Metodologia6 from "@/components/Metodologia6";

const TABS = ["METODOLOGÍA 1", "METODOLOGÍA 2", "METODOLOGÍA 3", "METODOLOGÍA 4", "METODOLOGÍA 5", "METODOLOGÍA 6"] as const;
type Tab = (typeof TABS)[number];

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  "METODOLOGÍA 1": "GEX · VANNA · DEALER FLOW",
  "METODOLOGÍA 2": "Z-SCORE GEX + PCR",
  "METODOLOGÍA 3": "CONFLUENCE 3D",
  "METODOLOGÍA 4": "MAPA DE CALOR S/R",
  "METODOLOGÍA 5": "SEÑAL CONSOLIDADA",
  "METODOLOGÍA 6": "RÉGIMEN DE MERCADO",
};

const METHODOLOGY_INTROS: Record<Tab, { what: string; how: string; output: string }> = {
  "METODOLOGÍA 1": {
    what: "Perfil de Gamma Exposure (GEX) por strike — cuantifica cuánta gamma acumulan los dealers en cada nivel de precio y en qué dirección deben hedgear.",
    how: "Cuando el mercado cae hacia un strike con GEX positivo alto, los dealers compran para hedgear (soporte mecánico). Cuando sube hacia un strike con GEX negativo, los dealers venden (resistencia mecánica). La Vanna modela cómo cambia el delta con la volatilidad implícita.",
    output: "Niveles clave: Call Wall (mayor OI en calls), Put Wall (mayor OI en puts), Gamma Flip (precio donde el GEX neto cambia de signo), Soporte y Resistencia institucional.",
  },
  "METODOLOGÍA 2": {
    what: "Análisis Z-Score de GEX y Put/Call Ratio por strike — normaliza estadísticamente la exposición gamma e identifica strikes con mayor presión institucional combinada.",
    how: "Cada strike recibe un z-score de su GEX total y su PCR. La suma de ambos z-scores genera un 'Institutional Pressure Score'. Soporte = strike bajo spot con GEX positivo y PCR > 1 (más puts que calls = cobertura bajista institucional). Resistencia = strike sobre spot con GEX negativo y PCR < 1.",
    output: "Soporte y resistencia de máxima presión institucional, perfil de barras de GEX coloreado por z-score, tabla de strikes con scores normalizados.",
  },
  "METODOLOGÍA 3": {
    what: "Confluencia 3D multi-vencimiento — agrega GEX, OI y PCR de todos los vencimientos ponderados por tiempo (DTE), buscando niveles donde convergen múltiples señales.",
    how: "Cada vencimiento contribuye con peso exp(−DTE/45): vencimientos cercanos pesan más. Los tres ejes (GEX, OI total, PCR) se normalizan simultáneamente con z-score. El 'Confluence Score' suma los tres z-scores — cuanto mayor la magnitud, más fuerte el nivel institucional.",
    output: "Soporte y resistencia con mayor confluencia a través de todos los vencimientos disponibles, mapa de calor de scores por strike.",
  },
  "METODOLOGÍA 4": {
    what: "Mapa de calor 2D de Open Interest e IV Skew — visualiza la distribución del posicionamiento institucional a través de todos los strikes y vencimientos simultáneamente.",
    how: "Cada celda (strike × vencimiento) muestra el OI total con intensidad de color proporcional. La capa de IV Skew superpone el diferencial call/put IV por strike. Los vencimientos mensuales y trimestrales se destacan por su mayor concentración de flujo institucional.",
    output: "Mapa de calor interactivo, perfil agregado de OI por strike, curva de IV Skew por vencimiento seleccionado.",
  },
  "METODOLOGÍA 5": {
    what: "Señal consolidada multi-metodología — combina los niveles de M2, M3 y un análisis propio de triple filtro para generar un score direccional y niveles de alta confluencia.",
    how: "Pondera GEX × OI × PCR con tiempo de vencimiento para cada strike. Los niveles de soporte y resistencia de M2 y M3 se comparan con los de M5 — cuando los tres modelos convergen en el mismo precio, la señal es de máxima confianza. El centro de los tres pares S/R vs el spot genera el 'Center Bias' direccional.",
    output: "Score consolidado (−100 a +100), veredicto direccional, niveles de S/R de los tres modelos, convergencia 0–3/3.",
  },
  "METODOLOGÍA 6": {
    what: "Régimen de mercado en tiempo real — determina si el entorno macro actual favorece o invalida los modelos de GEX antes de operar cualquier señal.",
    how: "Cuatro señales independientes: VIX nivel (35%), estructura de plazos VIX/VIX3M (25%), SPY GEX total (30%) y SPY PCR (10%). La velocidad del VIX (+% en 5 días) actúa como detector de pánico anticipado. En PÁNICO o CRISIS las señales de GEX se suspenden automáticamente.",
    output: "Régimen detectado (COMPRESIÓN / TRANSICIÓN / EXPANSIÓN / PÁNICO AGUDO / CRISIS SISTÉMICA), multiplicador sobre el score de M5, Brief Operativo con entrada · objetivo · stop · R/R ajustados por régimen.",
  },
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("METODOLOGÍA 1");
  const [ticker, setTicker] = useState("SPY");
  const [expiration, setExpiration] = useState("");
  const [expirations, setExpirations] = useState<string[]>([]);
  const [analyzeKey, setAnalyzeKey] = useState(0);
  const [loadingExps, setLoadingExps] = useState(false);

  async function handleAnalyze() {
    if (!ticker.trim()) return;
    setLoadingExps(true);
    try {
      const res = await fetch(`/api/expirations?ticker=${ticker}`);
      const json = await res.json();
      if (res.ok && json.expirations?.length > 0) {
        setExpirations(json.expirations);
        if (!expiration || !json.expirations.includes(expiration)) {
          setExpiration(json.expirations[0]);
        }
      }
    } catch {}
    setLoadingExps(false);
    setAnalyzeKey((k) => k + 1);
  }

  return (
    <div className="min-h-screen bg-bg text-gray-900">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center gap-4 bg-bg sticky top-0 z-50 shadow-sm">
        <span className="text-accent font-bold text-2xl tracking-[0.3em]">SORE</span>
        <span className="text-muted text-sm tracking-widest hidden sm:block">
          INSTITUTIONAL OPTIONS FLOW
        </span>
      </header>

      {/* Global Controls — ticker + expiration together */}
      <div className="border-b-2 border-accent px-6 py-3 flex items-center gap-3 bg-surface flex-wrap sticky top-[73px] z-40 shadow-sm">
        <input
          className="bg-bg border border-border text-gray-900 px-4 py-2 text-base uppercase tracking-widest w-28 focus:outline-none focus:border-accent transition-colors"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          placeholder="TICKER"
          maxLength={10}
        />

        {expirations.length > 0 && (
          <select
            className="bg-bg border border-border text-gray-900 px-3 py-2 text-base focus:outline-none focus:border-accent transition-colors"
            value={expiration}
            onChange={(e) => setExpiration(e.target.value)}
          >
            {Object.entries(
              expirations.reduce<Record<string, string[]>>((acc, exp) => {
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
                  const d = new Date(exp + "T12:00:00");
                  const dow = d.getDay();
                  const day = d.getDate();
                  const mon = d.getMonth();
                  const isThirdFri = dow === 5 && day >= 15 && day <= 21;
                  const isQuart = isThirdFri && [2, 5, 8, 11].includes(mon);
                  const isMon = isThirdFri && !isQuart;
                  const suffix = isQuart ? " ★ TRIMESTRAL" : isMon ? " · MENSUAL" : "";
                  return <option key={exp} value={exp}>{exp}{suffix}</option>;
                })}
              </optgroup>
            ))}
          </select>
        )}

        <button
          onClick={handleAnalyze}
          disabled={loadingExps}
          className="bg-accent text-white px-6 py-2 text-base font-bold tracking-widest hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          {loadingExps ? "..." : "ANALYZE"}
        </button>

        {analyzeKey > 0 && (
          <span className="text-xs text-muted">
            {ticker}{expiration ? ` · ${expiration}` : ""} · {expirations.length} vencimientos
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-6 flex gap-0 bg-bg">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-bold tracking-widest border-b-2 transition-colors flex flex-col items-start ${
              activeTab === tab
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-gray-900"
            }`}
          >
            <span>{tab}</span>
            <span className="text-[9px] font-normal tracking-wider opacity-60 hidden sm:block">
              {TAB_DESCRIPTIONS[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Methodology intro strip */}
      {(() => {
        const intro = METHODOLOGY_INTROS[activeTab];
        return (
          <div className="px-6 py-4 bg-surface border-b border-border grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-[9px] text-muted tracking-widest font-bold mb-1">QUÉ MIDE</div>
              <div className="text-xs text-gray-700 leading-relaxed">{intro.what}</div>
            </div>
            <div>
              <div className="text-[9px] text-muted tracking-widest font-bold mb-1">CÓMO FUNCIONA</div>
              <div className="text-xs text-gray-700 leading-relaxed">{intro.how}</div>
            </div>
            <div>
              <div className="text-[9px] text-muted tracking-widest font-bold mb-1">QUÉ PRODUCE</div>
              <div className="text-xs text-gray-700 leading-relaxed">{intro.output}</div>
            </div>
          </div>
        );
      })()}

      {/* Content — always mounted to preserve data state when switching tabs */}
      <div className={activeTab === "METODOLOGÍA 1" ? "" : "hidden"}>
        <Metodologia1 ticker={ticker} expiration={expiration} analyzeKey={analyzeKey} />
      </div>
      <div className={activeTab === "METODOLOGÍA 2" ? "" : "hidden"}>
        <Metodologia2 ticker={ticker} expiration={expiration} analyzeKey={analyzeKey} />
      </div>
      <div className={activeTab === "METODOLOGÍA 3" ? "" : "hidden"}>
        <Metodologia3 ticker={ticker} expiration={expiration} analyzeKey={analyzeKey} />
      </div>
      <div className={activeTab === "METODOLOGÍA 4" ? "" : "hidden"}>
        <Metodologia4 ticker={ticker} expiration={expiration} analyzeKey={analyzeKey} />
      </div>
      <div className={activeTab === "METODOLOGÍA 5" ? "" : "hidden"}>
        <Metodologia5 ticker={ticker} expiration={expiration} analyzeKey={analyzeKey} />
      </div>
      <div className={activeTab === "METODOLOGÍA 6" ? "" : "hidden"}>
        <Metodologia6 ticker={ticker} expiration={expiration} analyzeKey={analyzeKey} />
      </div>
    </div>
  );
}
