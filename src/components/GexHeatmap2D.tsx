"use client";

import type { Heatmap2DData } from "@/app/api/heatmap2d/route";

// ─── Expiration type detection ────────────────────────────────────────────────
// Monthly = 3rd Friday of any month (day 15–21, Friday)
// Quarterly = 3rd Friday of Mar/Jun/Sep/Dec (quad witching)
// Weekly = everything else

function getExpType(dateStr: string): "quarterly" | "monthly" | "weekly" {
  const d = new Date(dateStr + "T12:00:00");
  const day   = d.getDate();
  const dow   = d.getDay(); // 5 = Friday
  const month = d.getMonth(); // 0-indexed

  const isThirdFriday = dow === 5 && day >= 15 && day <= 21;
  if (!isThirdFriday) return "weekly";

  const isQuarterEnd = [2, 5, 8, 11].includes(month); // Mar Jun Sep Dec
  return isQuarterEnd ? "quarterly" : "monthly";
}

const EXP_STYLE = {
  quarterly: {
    headerBg:    "#1a237e",
    headerColor: "#fff",
    colBg:       "rgba(26,35,126,0.06)",
    badge:       "TRIM",
    badgeColor:  "#fff",
    badgeBg:     "#1a237e",
    borderTop:   "3px solid #1a237e",
  },
  monthly: {
    headerBg:    "#0d47a1",
    headerColor: "#fff",
    colBg:       "rgba(13,71,161,0.04)",
    badge:       "MEN",
    badgeColor:  "#fff",
    badgeBg:     "#1565c0",
    borderTop:   "3px solid #1565c0",
  },
  weekly: {
    headerBg:    "transparent",
    headerColor: "#9e9e9e",
    colBg:       "transparent",
    badge:       "",
    badgeColor:  "",
    badgeBg:     "",
    borderTop:   "none",
  },
};

// ─── Color helpers ────────────────────────────────────────────────────────────

function gexColor(gex: number, maxAbs: number): string {
  const t = Math.min(Math.abs(gex) / maxAbs, 1);
  const alpha = (0.12 + t * 0.82).toFixed(2);
  return gex >= 0
    ? `rgba(0,168,84,${alpha})`
    : `rgba(229,57,53,${alpha})`;
}

function textColor(gex: number, maxAbs: number): string {
  const t = Math.min(Math.abs(gex) / maxAbs, 1);
  return 0.12 + t * 0.82 > 0.5 ? "#fff" : "#374151";
}

function fmtGex(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return `${(v / 1e3).toFixed(0)}K`;
}

function fmtOI(v: number): string {
  return v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v);
}

function shortExp(exp: string): string {
  const d = new Date(exp + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GexHeatmap2D({ data }: { data: Heatmap2DData }) {
  const { strikes, expirations, cells, spot, support, resistance } = data;

  const cellMap = new Map<string, { gex: number; oi: number }>();
  for (const c of cells) {
    cellMap.set(`${c.strike}_${c.expiration}`, { gex: c.gex, oi: c.oi });
  }

  const maxAbsGex = Math.max(...cells.map((c) => Math.abs(c.gex)), 1);
  const maxOI     = Math.max(...cells.map((c) => c.oi), 1);

  const CELL_W  = 80;
  const CELL_H  = 36;
  const LABEL_W = 72;
  const HDR_H   = 56;

  const expTypes = expirations.map(getExpType);

  return (
    <div className="overflow-auto">

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 mb-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded" style={{ background: "rgba(0,168,84,0.82)" }} />
          GEX positivo — soporte
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded" style={{ background: "rgba(229,57,53,0.82)" }} />
          GEX negativo — resistencia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded" style={{ background: "#1a237e" }} />
          Trimestral (quad witching)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded" style={{ background: "#1565c0" }} />
          Mensual (3er viernes)
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          <span className="inline-block w-6 h-3 rounded" style={{ background: "rgba(21,101,192,0.85)" }} />
          Barra azul = OI
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${LABEL_W}px repeat(${expirations.length}, ${CELL_W}px)`,
          gap: "2px",
        }}
      >
        {/* Header row */}
        <div
          className="flex items-end justify-end pr-2 pb-1 text-[9px] font-bold tracking-widest text-muted"
          style={{ height: HDR_H }}
        >
          STRIKE
        </div>

        {expirations.map((exp, i) => {
          const style = EXP_STYLE[expTypes[i]];
          return (
            <div
              key={exp}
              className="flex flex-col items-center justify-end pb-1 text-center"
              style={{
                height: HDR_H,
                background: style.headerBg !== "transparent" ? style.headerBg : undefined,
                borderRadius: "4px 4px 0 0",
                borderTop: style.borderTop,
              }}
            >
              {style.badge && (
                <div
                  style={{
                    fontSize: 7,
                    fontWeight: 900,
                    letterSpacing: "0.1em",
                    color: style.badgeColor,
                    lineHeight: 1,
                    marginBottom: 2,
                  }}
                >
                  {style.badge}
                </div>
              )}
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: style.headerColor,
                  lineHeight: 1,
                }}
              >
                {shortExp(exp)}
              </div>
              <div
                style={{
                  fontSize: 8,
                  color: style.headerColor,
                  opacity: 0.7,
                  lineHeight: 1.2,
                }}
              >
                {exp.slice(0, 7)}
              </div>
            </div>
          );
        })}

        {/* Data rows */}
        {strikes.map((strike) => {
          const isSupport    = strike === support;
          const isResistance = strike === resistance;
          const isSpot       = Math.abs(strike - spot) < 0.5;

          const rowBorderColor = isResistance ? "#e53935"
            : isSupport ? "#00a854"
            : isSpot    ? "#f5a623"
            : "transparent";

          return (
            <>
              {/* Strike label */}
              <div
                key={`label_${strike}`}
                className="flex flex-col items-end justify-center pr-2"
                style={{
                  height: CELL_H,
                  borderLeft: `3px solid ${rowBorderColor}`,
                  background: isSpot ? "rgba(245,166,35,0.08)" : undefined,
                }}
              >
                <div className="text-[10px] font-mono font-bold text-gray-700">${strike}</div>
                {isResistance && <div className="text-[7px] font-bold text-danger leading-none">RES ▲</div>}
                {isSupport    && <div className="text-[7px] font-bold text-accent leading-none">SUP ▼</div>}
                {isSpot       && <div className="text-[7px] font-bold text-yellow-600 leading-none">SPOT</div>}
              </div>

              {/* Cells per expiration */}
              {expirations.map((exp, i) => {
                const colBg = EXP_STYLE[expTypes[i]].colBg;
                const cell  = cellMap.get(`${strike}_${exp}`);

                if (!cell) {
                  return (
                    <div
                      key={`${strike}_${exp}`}
                      style={{
                        height: CELL_H,
                        background: colBg || "#f5f5f5",
                        borderRadius: 2,
                      }}
                    />
                  );
                }

                const bg    = gexColor(cell.gex, maxAbsGex);
                const fg    = textColor(cell.gex, maxAbsGex);
                const oiPct = Math.max(6, (cell.oi / maxOI) * 100);

                return (
                  <div
                    key={`${strike}_${exp}`}
                    title={`Strike $${strike} | ${exp} (${expTypes[i]})\nGEX: ${fmtGex(cell.gex)}\nOI: ${fmtOI(cell.oi)}`}
                    style={{
                      height: CELL_H,
                      background: bg,
                      borderRadius: 2,
                      position: "relative",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1,
                      outline: expTypes[i] !== "weekly" ? `2px solid ${EXP_STYLE[expTypes[i]].badgeBg}` : undefined,
                      outlineOffset: "-1px",
                    }}
                  >
                    <div style={{ color: fg, fontSize: 9, fontFamily: "monospace", fontWeight: 700, lineHeight: 1 }}>
                      {fmtGex(cell.gex)}
                    </div>
                    <div style={{ width: "80%", height: 4, background: "rgba(255,255,255,0.25)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${oiPct}%`, height: "100%", background: "rgba(21,101,192,0.75)", borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </>
          );
        })}
      </div>

      <div className="mt-3 text-[9px] text-muted text-center tracking-widest">
        FECHAS DE VENCIMIENTO →
      </div>
    </div>
  );
}
