"use client";

import { useState } from "react";
import Metodologia1 from "@/components/Metodologia1";
import Metodologia2 from "@/components/Metodologia2";
import Metodologia3 from "@/components/Metodologia3";
import Metodologia4 from "@/components/Metodologia4";

const TABS = ["METODOLOGÍA 1", "METODOLOGÍA 2", "METODOLOGÍA 3", "METODOLOGÍA 4"] as const;
type Tab = (typeof TABS)[number];

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  "METODOLOGÍA 1": "GEX · VANNA · DEALER FLOW",
  "METODOLOGÍA 2": "Z-SCORE GEX + PCR",
  "METODOLOGÍA 3": "CONFLUENCE 3D",
  "METODOLOGÍA 4": "MAPA DE CALOR S/R",
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("METODOLOGÍA 1");

  return (
    <div className="min-h-screen bg-bg text-gray-900">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center gap-4 bg-bg sticky top-0 z-50 shadow-sm">
        <span className="text-accent font-bold text-2xl tracking-[0.3em]">SORE</span>
        <span className="text-muted text-sm tracking-widest hidden sm:block">
          INSTITUTIONAL OPTIONS FLOW
        </span>
      </header>

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

      {/* Content */}
      {activeTab === "METODOLOGÍA 1" && <Metodologia1 />}
      {activeTab === "METODOLOGÍA 2" && <Metodologia2 />}
      {activeTab === "METODOLOGÍA 3" && <Metodologia3 />}
      {activeTab === "METODOLOGÍA 4" && <Metodologia4 />}
    </div>
  );
}
