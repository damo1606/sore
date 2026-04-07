"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Dot,
} from "recharts";

interface ClarityPoint {
  date: string;
  recorded_at: string;
  confidence: number;
  score: number;
  regime: string;
  spot: number;
  isMonthlyOpex: boolean;
}

interface Props {
  ticker: string;
}

function regimeColor(regime: string): string {
  const r = regime.toLowerCase();
  if (r.includes("bull") || r.includes("alcist")) return "#22c55e";
  if (r.includes("bear") || r.includes("bajist")) return "#ef4444";
  return "#6b7280";
}

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  const color = regimeColor(payload.regime);
  const r = payload.isMonthlyOpex ? 7 : 4;
  return <circle cx={cx} cy={cy} r={r} fill={color} stroke="#1a1a2e" strokeWidth={1.5} />;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: ClarityPoint = payload[0].payload;
  return (
    <div className="bg-card border border-border p-3 text-xs space-y-1 shadow-lg">
      <p className="font-bold text-accent tracking-widest">{d.date}{d.isMonthlyOpex ? " · OPEX" : " · WEEKLY"}</p>
      <p className="text-muted">CONFIANZA <span className="text-foreground font-mono font-bold">{d.confidence}%</span></p>
      <p className="text-muted">SCORE <span className={`font-mono font-bold ${d.score >= 0 ? "text-accent" : "text-danger"}`}>{d.score > 0 ? "+" : ""}{d.score}</span></p>
      <p className="text-muted">RÉGIMEN <span className="text-foreground">{d.regime}</span></p>
      <p className="text-muted">SPOT <span className="font-mono text-foreground">${d.spot?.toFixed(2)}</span></p>
    </div>
  );
}

export default function ExpirationClarityChart({ ticker }: Props) {
  const [points, setPoints] = useState<ClarityPoint[]>([]);
  const [metric, setMetric] = useState<"confidence" | "score">("confidence");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    fetch(`/api/clarity?ticker=${ticker}`)
      .then((r) => r.json())
      .then((j) => setPoints(j.points ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <div className="h-40 flex items-center justify-center text-xs text-muted tracking-widest">CARGANDO HISTORIAL...</div>;
  if (!points.length) return <div className="h-24 flex items-center justify-center text-xs text-muted tracking-widest opacity-50">SIN DATOS HISTÓRICOS · ANALIZA {ticker} EN FECHAS DE VENCIMIENTO</div>;

  const domain: [number, number] = metric === "confidence" ? [0, 100] : [-100, 100];

  return (
    <div className="space-y-3">
      {/* Toggle métrica */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-muted tracking-widest font-bold">
          CLARIDAD HISTÓRICA EN VENCIMIENTOS · {points.length} PUNTOS
        </p>
        <div className="flex gap-1">
          {(["confidence", "score"] as const).map((m) => (
            <button key={m} onClick={() => setMetric(m)} className={`text-[10px] px-2 py-0.5 border tracking-widest transition-colors ${metric === m ? "bg-accent text-white border-accent" : "border-border text-muted hover:text-text"}`}>
              {m === "confidence" ? "CONFIANZA" : "SCORE"}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={points} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={domain} tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false} />
          {metric === "score" && <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 2" />}
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey={metric}
            stroke="#22c55e"
            strokeWidth={1.5}
            dot={<CustomDot />}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Leyenda */}
      <div className="flex gap-4 text-[9px] text-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-accent inline-block" />ALCISTA</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-danger inline-block" />BAJISTA</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-500 inline-block" />NEUTRAL</span>
        <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 rounded-full border-2 border-accent inline-block" />OPEX MENSUAL</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border-2 border-accent inline-block" />WEEKLY</span>
      </div>
    </div>
  );
}
