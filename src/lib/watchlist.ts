/**
 * watchlist.ts
 *
 * Listas de tickers de defecto para el scanner de proximidad.
 * 37 tickers únicos sin repetición entre listas.
 */

export interface WatchlistTicker {
  ticker: string;
  label:  string;
  list:   1 | 2 | 3;
}

// Lista 1 — Rotación de capital (13 ETFs sectoriales + macro)
export const LISTA_1: WatchlistTicker[] = [
  { ticker: "QQQ",  label: "Tech / Growth",        list: 1 },
  { ticker: "XLK",  label: "Tecnología",            list: 1 },
  { ticker: "XLY",  label: "Consumo discrecional",  list: 1 },
  { ticker: "XLC",  label: "Comunicaciones",         list: 1 },
  { ticker: "XLF",  label: "Financiero",             list: 1 },
  { ticker: "XLE",  label: "Energia",                list: 1 },
  { ticker: "XLI",  label: "Industrial",             list: 1 },
  { ticker: "XLB",  label: "Materiales",             list: 1 },
  { ticker: "XLV",  label: "Salud",                  list: 1 },
  { ticker: "XLP",  label: "Consumo basico",         list: 1 },
  { ticker: "TLT",  label: "Bonos largo plazo",      list: 1 },
  { ticker: "GLD",  label: "Oro / Macro",            list: 1 },
  { ticker: "HYG",  label: "Bonos basura / Credito", list: 1 },
];

// Lista 2 — Mayor prima de negociacion (12 acciones individuales)
export const LISTA_2: WatchlistTicker[] = [
  { ticker: "NVDA",  label: "Semiconductores",   list: 2 },
  { ticker: "AAPL",  label: "Tech",              list: 2 },
  { ticker: "TSLA",  label: "Consumo / EV",      list: 2 },
  { ticker: "AMZN",  label: "Consumo / Cloud",   list: 2 },
  { ticker: "META",  label: "Comunicaciones",    list: 2 },
  { ticker: "MSFT",  label: "Tech",              list: 2 },
  { ticker: "AMD",   label: "Semiconductores",   list: 2 },
  { ticker: "GOOGL", label: "Comunicaciones",    list: 2 },
  { ticker: "NFLX",  label: "Entretenimiento",   list: 2 },
  { ticker: "PLTR",  label: "AI / Data",         list: 2 },
  { ticker: "COIN",  label: "Crypto / Fintech",  list: 2 },
  { ticker: "MSTR",  label: "Bitcoin proxy",     list: 2 },
];

// Lista 3 — Mayor liquidez de negociacion (12 tickers)
export const LISTA_3: WatchlistTicker[] = [
  { ticker: "SPY",  label: "Mercado amplio",  list: 3 },
  { ticker: "IWM",  label: "Small caps",      list: 3 },
  { ticker: "EEM",  label: "Merc. emergentes",list: 3 },
  { ticker: "JPM",  label: "Financiero",      list: 3 },
  { ticker: "GS",   label: "Financiero",      list: 3 },
  { ticker: "BAC",  label: "Financiero",      list: 3 },
  { ticker: "XOM",  label: "Energia",         list: 3 },
  { ticker: "LLY",  label: "Salud / Pharma",  list: 3 },
  { ticker: "UNH",  label: "Salud / Seguros", list: 3 },
  { ticker: "V",    label: "Pagos",           list: 3 },
  { ticker: "COST", label: "Consumo",         list: 3 },
  { ticker: "KO",   label: "Consumo basico",  list: 3 },
];

export const DEFAULT_WATCHLIST: WatchlistTicker[] = [...LISTA_1, ...LISTA_2, ...LISTA_3];

export const LIST_LABELS: Record<number, string> = {
  1: "ROTACION SECTORIAL",
  2: "PRIMA DE NEGOCIACION",
  3: "LIQUIDEZ",
};

export const LIST_COLORS: Record<number, string> = {
  1: "#6366f1", // indigo
  2: "#f59e0b", // amber
  3: "#22c55e", // green
};
