"use client";

import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "sore-portafolio";

interface SearchResult { symbol: string; name: string; exchange: string; }

export default function PortafolioPage() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dark, setDark] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setTickers(JSON.parse(saved));
    } catch {}
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
  }, [tickers]);

  // Debounced autocomplete
  useEffect(() => {
    if (query.length < 1) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        setSuggestions(json.results ?? []);
        setShowSuggestions(true);
      } catch { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function addTicker(symbol: string) {
    const s = symbol.toUpperCase().trim();
    if (!s || tickers.includes(s)) return;
    setTickers((prev) => [...prev, s]);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function removeTicker(symbol: string) {
    setTickers((prev) => prev.filter((t) => t !== symbol));
  }

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("sore-theme", isDark ? "dark" : "light");
    setDark(isDark);
  }

  return (
    <div className="min-h-screen bg-bg text-text">

      {/* Header */}
      <header className="border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between bg-bg sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <a href="/" className="text-accent font-bold text-xl sm:text-2xl tracking-[0.3em]">SORE</a>
          <span className="text-xs text-accent border border-accent px-3 py-1 tracking-widest font-bold hidden sm:block">
            INSTITUTIONAL OPTIONS FLOW
          </span>
          <a href="/scanner" className="text-xs text-muted border border-border px-3 py-1 tracking-widest hover:text-accent hover:border-accent transition-colors hidden sm:block">
            SCANNER
          </a>
          <a href="/portafolio" className="text-xs text-accent border border-accent px-3 py-1 tracking-widest font-bold hidden sm:block">
            PORTAFOLIO
          </a>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="text-xs text-muted border border-border px-3 py-1 tracking-widest hover:text-accent hover:border-accent transition-colors"
          >
            {dark ? "☀ CLARO" : "◑ OSCURO"}
          </button>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
            className="text-xs text-white tracking-widest bg-red-600 hover:bg-red-700 transition-colors px-3 py-1 font-bold"
          >
            CERRAR SESIÓN
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-[0.3em] text-accent mb-1">PORTAFOLIO</h1>
          <p className="text-xs text-muted tracking-widest">
            Agrega los tickers que quieres monitorear. Haz clic en cualquier ticker para analizarlo.
          </p>
        </div>

        {/* Input */}
        <div className="bg-card border border-border p-6 mb-8">
          <div className="text-xs text-muted tracking-widest mb-4 font-semibold">AGREGAR TICKER</div>
          <div className="flex gap-3">
            <div ref={searchRef} className="relative flex-1">
              <input
                className="w-full bg-bg border border-border text-text px-4 py-3 text-sm uppercase tracking-widest focus:outline-none focus:border-accent transition-colors"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value.toUpperCase());
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (suggestions.length > 0) addTicker(suggestions[0].symbol);
                    else addTicker(query);
                  }
                  if (e.key === "Escape") setShowSuggestions(false);
                }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="ESCRIBE UN TICKER O EMPRESA..."
                maxLength={40}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-bg border border-border shadow-lg max-h-64 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.symbol}
                      onMouseDown={() => addTicker(s.symbol)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface text-left border-b border-border last:border-0 gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-accent shrink-0">{s.symbol}</span>
                        <span className="text-xs text-subtle truncate">{s.name}</span>
                      </div>
                      <span className="text-[10px] text-muted shrink-0">{s.exchange}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                if (suggestions.length > 0) addTicker(suggestions[0].symbol);
                else addTicker(query);
              }}
              className="bg-accent text-white px-6 py-3 text-sm font-bold tracking-widest hover:opacity-80 transition-opacity shrink-0"
            >
              AGREGAR
            </button>
          </div>
        </div>

        {/* Ticker list */}
        {tickers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted">
            <div className="w-16 h-16 border border-border flex items-center justify-center text-3xl text-border">◈</div>
            <p className="text-sm tracking-widest">TU PORTAFOLIO ESTÁ VACÍO</p>
            <p className="text-xs opacity-60 tracking-widest">Agrega tickers arriba para comenzar</p>
          </div>
        ) : (
          <div>
            <div className="text-xs text-muted tracking-widest mb-4 font-semibold">
              {tickers.length} TICKER{tickers.length !== 1 ? "S" : ""} EN PORTAFOLIO
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {tickers.map((t) => (
                <div key={t} className="bg-card border border-border p-4 flex items-center justify-between group hover:border-accent transition-colors">
                  <a
                    href={`/?ticker=${t}`}
                    className="text-sm font-black tracking-widest text-accent hover:underline"
                  >
                    {t}
                  </a>
                  <button
                    onClick={() => removeTicker(t)}
                    className="text-muted hover:text-danger transition-colors text-xs opacity-0 group-hover:opacity-100"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="mt-8 flex gap-3">
              <a
                href="/"
                className="text-xs text-muted border border-border px-4 py-2 tracking-widest hover:text-accent hover:border-accent transition-colors"
              >
                IR AL ANÁLISIS
              </a>
              <button
                onClick={() => {
                  if (confirm("¿Eliminar todos los tickers del portafolio?")) setTickers([]);
                }}
                className="text-xs text-muted border border-border px-4 py-2 tracking-widest hover:text-danger hover:border-danger transition-colors"
              >
                LIMPIAR TODO
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
