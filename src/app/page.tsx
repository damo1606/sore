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
        <Metodologia6 analyzeKey={analyzeKey} />
      </div>
    </div>
  );
}
