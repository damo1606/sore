"use client";

import type { Heatmap2DData } from "@/app/api/heatmap2d/route";

function gexColor(gex: number, maxAbs: number): string {
  const t = Math.min(Math.abs(gex) / maxAbs, 1);
  const alpha = (0.12 + t * 0.82).toFixed(2);
  return gex >= 0
    ? `rgba(0,168,84,${alpha})`
    : `rgba(229,57,53,${alpha})`;
}

function textColor(gex: number, maxAbs: number): string {
  const t = Math.min(Math.abs(gex) / maxAbs, 1);
  const alpha = 0.12 + t * 0.82;
  return alpha > 0.5 ? "#fff" : "#374151";
}

function fmtGex(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return `${(v / 1e3).toFixed(0)}K`;
}

function fmtOI(v: number): string {
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

function shortExp(exp: string): string {
  // "2025-04-17" → "Apr 17"
  const d = new Date(exp + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function GexHeatmap2D({ data }: { data: Heatmap2DData }) {
  const { strikes, expirations, cells, spot, support, resistance } = data;

  // Build lookup map: cells[strike][expiration]
  const cellMap = new Map<string, { gex: number; oi: number }>();
  const maxOIPerExp = new Map<string, number>();

  for (const c of cells) {
    cellMap.set(`${c.strike}_${c.expiration}`, { gex: c.gex, oi: c.oi });
    const cur = maxOIPerExp.get(c.expiration) ?? 0;
    if (c.oi > cur) maxOIPerExp.set(c.expiration, c.oi);
  }

  const maxAbsGex = Math.max(...cells.map((c) => Math.abs(c.gex)), 1);
  const maxOI = Math.max(...cells.map((c) => c.oi), 1);

  const CELL_W = 80;
  const CELL_H = 36;
  const LABEL_W = 72;
  const HDR_H = 44;

  return (
    <div className="overflow-auto">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 mb-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded" style={{ background: "rgba(0,168,84,0.82)" }} />
          GEX positivo — soporte (dealers largo gamma)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded" style={{ background: "rgba(229,57,53,0.82)" }} />
          GEX negativo — resistencia (dealers corto gamma)
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          <span className="inline-block w-10 h-3 rounded" style={{ background: "rgba(21,101,192,0.35)" }} />
          <span className="inline-block w-6 h-3 rounded" style={{ background: "rgba(21,101,192,0.85)" }} />
          Barra azul = OI (ancho = magnitud)
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
        {expirations.map((exp) => (
          <div
            key={exp}
            className="flex flex-col items-center justify-end pb-1 text-center"
            style={{ height: HDR_H }}
          >
            <div className="text-[9px] font-bold tracking-widest text-muted leading-tight">
              {shortExp(exp)}
            </div>
            <div className="text-[8px] text-muted opacity-60 leading-tight">{exp.slice(0, 7)}</div>
          </div>
        ))}

        {/* Data rows */}
        {strikes.map((strike) => {
          const isSupport    = strike === support;
          const isResistance = strike === resistance;
          const isSpot       = Math.abs(strike - spot) < 0.5;

          const rowBorderColor = isResistance
            ? "#e53935"
            : isSupport
            ? "#00a854"
            : isSpot
            ? "#f5a623"
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
              {expirations.map((exp) => {
                const cell = cellMap.get(`${strike}_${exp}`);
                if (!cell) {
                  return (
                    <div
                      key={`${strike}_${exp}`}
                      style={{ height: CELL_H, background: "#f5f5f5", borderRadius: 2 }}
                    />
                  );
                }

                const bg = gexColor(cell.gex, maxAbsGex);
                const fg = textColor(cell.gex, maxAbsGex);
                const oiPct = Math.max(6, (cell.oi / maxOI) * 100);

                return (
                  <div
                    key={`${strike}_${exp}`}
                    title={`Strike $${strike} | ${exp}\nGEX: ${fmtGex(cell.gex)}\nOI: ${fmtOI(cell.oi)}`}
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
                    }}
                  >
                    {/* GEX label */}
                    <div
                      style={{
                        color: fg,
                        fontSize: 9,
                        fontFamily: "monospace",
                        fontWeight: 700,
                        lineHeight: 1,
                        zIndex: 1,
                      }}
                    >
                      {fmtGex(cell.gex)}
                    </div>

                    {/* OI bar */}
                    <div
                      style={{
                        width: "80%",
                        height: 4,
                        background: "rgba(255,255,255,0.25)",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${oiPct}%`,
                          height: "100%",
                          background: "rgba(21,101,192,0.75)",
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </>
          );
        })}
      </div>

      {/* Bottom axis label */}
      <div className="mt-3 text-[9px] text-muted text-center tracking-widest">
        FECHAS DE VENCIMIENTO →
      </div>
    </div>
  );
}
