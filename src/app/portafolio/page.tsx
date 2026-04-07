"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "sore-portafolios-v2";
const MAX_PORTFOLIOS = 8;

interface Portfolio {
  id: string;
  name: string;
  tickers: string[];
  createdAt: string;
}

interface SearchResult { symbol: string; name: string; exchange: string; }

type Direction = "CALL" | "PUT" | "LONG" | "SHORT";
type TradeStatus = "open" | "closed";

interface Trade {
  id: number;
  created_at: string;
  ticker: string;
  direction: Direction;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  status: TradeStatus;
  outcome_pnl: number | null;
  notes: string | null;
}

const DIR_COLOR: Record<Direction, string> = {
  CALL:  "text-accent",
  LONG:  "text-accent",
  PUT:   "text-danger",
  SHORT: "text-danger",
};

function createPortfolio(name: string): Portfolio {
  return {
    id: Date.now().toString(),
    name,
    tickers: [],
    createdAt: new Date().toISOString(),
  };
}

export default function PortafolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [dark, setDark] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // ── Trade log state ────────────────────────────────────────────────────────
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeFilter, setTradeFilter] = useState<"open" | "closed" | "all">("open");
  const [tradeForm, setTradeForm] = useState({ ticker: "", direction: "CALL" as Direction, entry_price: "", stop_loss: "", take_profit: "", notes: "" });
  const [tradeFormOpen, setTradeFormOpen] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [closePnl, setClosePnl] = useState("");

  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch(`/api/trades?status=${tradeFilter}`);
      const json = await res.json();
      setTrades(json.trades ?? []);
    } catch {}
  }, [tradeFilter]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: Portfolio[] = JSON.parse(saved);
        setPortfolios(parsed);
        setActiveId(parsed[0]?.id ?? "");
      } else {
        const first = createPortfolio("PORTAFOLIO 1");
        setPortfolios([first]);
        setActiveId(first.id);
      }
    } catch {
      const first = createPortfolio("PORTAFOLIO 1");
      setPortfolios([first]);
      setActiveId(first.id);
    }
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (portfolios.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolios));
    }
  }, [portfolios]);

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

  // Focus name input when editing
  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

  const active = portfolios.find((p) => p.id === activeId) ?? null;

  function addPortfolio() {
    if (portfolios.length >= MAX_PORTFOLIOS) return;
    const p = createPortfolio(`PORTAFOLIO ${portfolios.length + 1}`);
    setPortfolios((prev) => [...prev, p]);
    setActiveId(p.id);
  }

  function deletePortfolio(id: string) {
    if (!confirm("¿Eliminar este portafolio?")) return;
    const updated = portfolios.filter((p) => p.id !== id);
    setPortfolios(updated);
    setActiveId(updated[0]?.id ?? "");
    if (updated.length === 0) {
      const first = createPortfolio("PORTAFOLIO 1");
      setPortfolios([first]);
      setActiveId(first.id);
    }
  }

  function updateActive(fn: (p: Portfolio) => Portfolio) {
    setPortfolios((prev) => prev.map((p) => (p.id === activeId ? fn(p) : p)));
  }

  function addTicker(symbol: string) {
    const s = symbol.toUpperCase().trim();
    if (!s || active?.tickers.includes(s)) return;
    updateActive((p) => ({ ...p, tickers: [...p.tickers, s] }));
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function removeTicker(symbol: string) {
    updateActive((p) => ({ ...p, tickers: p.tickers.filter((t) => t !== symbol) }));
  }

  function saveName() {
    const name = nameInput.trim().toUpperCase();
    if (name) updateActive((p) => ({ ...p, name }));
    setEditingName(false);
  }

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("sore-theme", isDark ? "dark" : "light");
    setDark(isDark);
  }

  async function submitTrade() {
    if (!tradeForm.ticker || !tradeForm.entry_price) return;
    await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...tradeForm, entry_price: Number(tradeForm.entry_price), stop_loss: tradeForm.stop_loss ? Number(tradeForm.stop_loss) : null, take_profit: tradeForm.take_profit ? Number(tradeForm.take_profit) : null }),
    });
    setTradeForm({ ticker: "", direction: "CALL", entry_price: "", stop_loss: "", take_profit: "", notes: "" });
    setTradeFormOpen(false);
    fetchTrades();
  }

  async function closeTrade(id: number) {
    await fetch(`/api/trades/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed", outcome_pnl: closePnl ? Number(closePnl) : null }),
    });
    setClosingId(null);
    setClosePnl("");
    fetchTrades();
  }

  async function deleteTrade(id: number) {
    if (!confirm("¿Eliminar este trade?")) return;
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    fetchTrades();
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
          <button onClick={toggleTheme} className="text-xs text-muted border border-border px-3 py-1 tracking-widest hover:text-accent hover:border-accent transition-colors">
            {dark ? "☀ CLARO" : "◑ OSCURO"}
          </button>
          <button
            onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}
            className="text-xs text-white tracking-widest bg-red-600 hover:bg-red-700 transition-colors px-3 py-1 font-bold"
          >
            CERRAR SESIÓN
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-[0.3em] text-accent mb-1">PORTAFOLIOS</h1>
          <p className="text-xs text-muted tracking-widest">Hasta {MAX_PORTFOLIOS} portafolios · Haz clic en un ticker para analizarlo</p>
        </div>

        {/* Portfolio tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {portfolios.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={`shrink-0 px-4 py-2 text-xs font-bold tracking-widest border transition-colors ${
                p.id === activeId
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-muted hover:text-accent hover:border-accent"
              }`}
            >
              {p.name}
              <span className="ml-2 opacity-50">{p.tickers.length}</span>
            </button>
          ))}
          {portfolios.length < MAX_PORTFOLIOS && (
            <button
              onClick={addPortfolio}
              className="shrink-0 px-4 py-2 text-xs font-bold tracking-widest border border-dashed border-border text-muted hover:text-accent hover:border-accent transition-colors"
            >
              + NUEVO
            </button>
          )}
          {portfolios.length >= MAX_PORTFOLIOS && (
            <span className="text-xs text-muted opacity-50 ml-2 shrink-0">Máximo {MAX_PORTFOLIOS} portafolios</span>
          )}
        </div>

        {/* Active portfolio */}
        {active && (
          <div className="bg-card border border-border">

            {/* Portfolio header */}
            <div className="border-b border-border px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {editingName ? (
                  <input
                    ref={nameRef}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value.toUpperCase())}
                    onBlur={saveName}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                    className="bg-bg border border-accent text-text px-3 py-1 text-sm font-bold tracking-widest focus:outline-none w-48"
                    maxLength={24}
                  />
                ) : (
                  <button
                    onClick={() => { setNameInput(active.name); setEditingName(true); }}
                    className="text-sm font-black tracking-widest text-text hover:text-accent transition-colors"
                    title="Doble clic para renombrar"
                  >
                    {active.name}
                  </button>
                )}
                <span className="text-xs text-muted">
                  {active.tickers.length} ticker{active.tickers.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted hidden sm:block">Clic en el nombre para editar</span>
                <button
                  onClick={() => deletePortfolio(active.id)}
                  className="text-xs text-muted border border-border px-3 py-1 tracking-widest hover:text-danger hover:border-danger transition-colors"
                >
                  ELIMINAR
                </button>
              </div>
            </div>

            {/* Add ticker input */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex gap-3">
                <div ref={searchRef} className="relative flex-1">
                  <input
                    className="w-full bg-bg border border-border text-text px-4 py-2.5 text-sm uppercase tracking-widest focus:outline-none focus:border-accent transition-colors"
                    value={query}
                    onChange={(e) => setQuery(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { suggestions.length > 0 ? addTicker(suggestions[0].symbol) : addTicker(query); }
                      if (e.key === "Escape") setShowSuggestions(false);
                    }}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="AGREGAR TICKER..."
                    maxLength={40}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-bg border border-border shadow-lg max-h-56 overflow-y-auto">
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
                  onClick={() => { suggestions.length > 0 ? addTicker(suggestions[0].symbol) : addTicker(query); }}
                  className="bg-accent text-white px-5 py-2.5 text-sm font-bold tracking-widest hover:opacity-80 transition-opacity shrink-0"
                >
                  + AGREGAR
                </button>
              </div>
            </div>

            {/* Tickers grid */}
            <div className="p-6">
              {active.tickers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted">
                  <div className="w-12 h-12 border border-border flex items-center justify-center text-2xl text-border">◈</div>
                  <p className="text-xs tracking-widest">PORTAFOLIO VACÍO — AGREGA TICKERS ARRIBA</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {active.tickers.map((t) => (
                      <div key={t} className="border border-border p-3 flex items-center justify-between group hover:border-accent transition-colors">
                        <a
                          href={`/?ticker=${t}`}
                          className="text-sm font-black tracking-widest text-accent hover:underline"
                        >
                          {t}
                        </a>
                        <button
                          onClick={() => removeTicker(t)}
                          className="text-muted hover:text-danger transition-colors text-xs opacity-0 group-hover:opacity-100 ml-2"
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex gap-3">
                    <a href="/" className="text-xs text-muted border border-border px-4 py-2 tracking-widest hover:text-accent hover:border-accent transition-colors">
                      IR AL ANÁLISIS
                    </a>
                    <button
                      onClick={() => { if (confirm("¿Eliminar todos los tickers?")) updateActive((p) => ({ ...p, tickers: [] })); }}
                      className="text-xs text-muted border border-border px-4 py-2 tracking-widest hover:text-danger hover:border-danger transition-colors"
                    >
                      LIMPIAR
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {/* ── TRADE LOG ────────────────────────────────────────────── */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black tracking-[0.3em] text-accent">TRADE LOG</h2>
              <p className="text-[10px] text-muted tracking-widest">Registro de operaciones vinculadas al análisis GEX</p>
            </div>
            <button
              onClick={() => setTradeFormOpen((v) => !v)}
              className="bg-accent text-white px-5 py-2 text-xs font-bold tracking-widest hover:opacity-80 transition-opacity"
            >
              {tradeFormOpen ? "CANCELAR" : "+ NUEVO TRADE"}
            </button>
          </div>

          {/* Formulario nuevo trade */}
          {tradeFormOpen && (
            <div className="bg-card border border-border p-5 mb-4 space-y-3">
              <p className="text-[9px] text-muted tracking-widest font-bold">REGISTRAR OPERACIÓN</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <input className="bg-bg border border-border text-text px-3 py-2 text-sm uppercase tracking-widest focus:outline-none focus:border-accent" placeholder="TICKER" value={tradeForm.ticker} onChange={(e) => setTradeForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))} maxLength={10} />
                <select className="bg-bg border border-border text-text px-3 py-2 text-sm tracking-widest focus:outline-none focus:border-accent" value={tradeForm.direction} onChange={(e) => setTradeForm((f) => ({ ...f, direction: e.target.value as Direction }))}>
                  <option value="CALL">CALL</option>
                  <option value="PUT">PUT</option>
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                </select>
                <input className="bg-bg border border-border text-text px-3 py-2 text-sm tracking-widest focus:outline-none focus:border-accent" placeholder="ENTRY PRICE" type="number" step="0.01" value={tradeForm.entry_price} onChange={(e) => setTradeForm((f) => ({ ...f, entry_price: e.target.value }))} />
                <input className="bg-bg border border-border text-text px-3 py-2 text-sm tracking-widest focus:outline-none focus:border-accent" placeholder="STOP LOSS" type="number" step="0.01" value={tradeForm.stop_loss} onChange={(e) => setTradeForm((f) => ({ ...f, stop_loss: e.target.value }))} />
                <input className="bg-bg border border-border text-text px-3 py-2 text-sm tracking-widest focus:outline-none focus:border-accent" placeholder="TAKE PROFIT" type="number" step="0.01" value={tradeForm.take_profit} onChange={(e) => setTradeForm((f) => ({ ...f, take_profit: e.target.value }))} />
                <input className="bg-bg border border-border text-text px-3 py-2 text-sm tracking-widest focus:outline-none focus:border-accent" placeholder="NOTAS" value={tradeForm.notes} onChange={(e) => setTradeForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <button onClick={submitTrade} className="bg-accent text-white px-6 py-2 text-xs font-bold tracking-widest hover:opacity-80 transition-opacity">
                GUARDAR TRADE
              </button>
            </div>
          )}

          {/* Filtros */}
          <div className="flex gap-2 mb-3">
            {(["open", "closed", "all"] as const).map((f) => (
              <button key={f} onClick={() => setTradeFilter(f)} className={`text-xs px-3 py-1 border tracking-widest transition-colors ${tradeFilter === f ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
                {f === "open" ? "ABIERTOS" : f === "closed" ? "CERRADOS" : "TODOS"}
              </button>
            ))}
          </div>

          {/* Tabla de trades */}
          {trades.length === 0 ? (
            <div className="bg-card border border-border py-12 flex flex-col items-center gap-2 text-muted">
              <p className="text-xs tracking-widest">SIN TRADES REGISTRADOS</p>
            </div>
          ) : (
            <div className="bg-card border border-border overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted tracking-widest text-left">
                    <th className="px-4 py-3">TICKER</th>
                    <th className="px-4 py-3">DIR</th>
                    <th className="px-4 py-3">ENTRY</th>
                    <th className="px-4 py-3">SL</th>
                    <th className="px-4 py-3">TP</th>
                    <th className="px-4 py-3">P&L</th>
                    <th className="px-4 py-3">NOTAS</th>
                    <th className="px-4 py-3">FECHA</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id} className="border-b border-border hover:bg-surface transition-colors">
                      <td className="px-4 py-3 font-bold text-accent">
                        <a href={`/?ticker=${t.ticker}`} className="hover:underline">{t.ticker}</a>
                      </td>
                      <td className={`px-4 py-3 font-bold ${DIR_COLOR[t.direction]}`}>{t.direction}</td>
                      <td className="px-4 py-3 font-mono">${t.entry_price.toFixed(2)}</td>
                      <td className="px-4 py-3 font-mono text-danger">{t.stop_loss ? `$${t.stop_loss.toFixed(2)}` : "—"}</td>
                      <td className="px-4 py-3 font-mono text-accent">{t.take_profit ? `$${t.take_profit.toFixed(2)}` : "—"}</td>
                      <td className={`px-4 py-3 font-mono font-bold ${t.outcome_pnl == null ? "text-muted" : t.outcome_pnl >= 0 ? "text-accent" : "text-danger"}`}>
                        {t.outcome_pnl == null ? "—" : `${t.outcome_pnl >= 0 ? "+" : ""}${t.outcome_pnl.toFixed(2)}`}
                      </td>
                      <td className="px-4 py-3 text-muted max-w-[150px] truncate">{t.notes ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{new Date(t.created_at).toLocaleDateString("es-ES")}</td>
                      <td className="px-4 py-3">
                        {t.status === "open" ? (
                          closingId === t.id ? (
                            <div className="flex gap-1 items-center">
                              <input type="number" step="0.01" placeholder="P&L" className="w-20 bg-bg border border-border px-2 py-1 text-xs focus:outline-none focus:border-accent" value={closePnl} onChange={(e) => setClosePnl(e.target.value)} />
                              <button onClick={() => closeTrade(t.id)} className="text-accent border border-accent px-2 py-1 text-[10px] hover:bg-accent hover:text-white transition-colors">OK</button>
                              <button onClick={() => setClosingId(null)} className="text-muted border border-border px-2 py-1 text-[10px]">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => { setClosingId(t.id); setClosePnl(""); }} className="text-xs text-warning border border-warning px-2 py-1 tracking-widest hover:bg-warning hover:text-white transition-colors">CERRAR</button>
                          )
                        ) : (
                          <button onClick={() => deleteTrade(t.id)} className="text-xs text-muted border border-border px-2 py-1 tracking-widest hover:text-danger hover:border-danger transition-colors">DEL</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
