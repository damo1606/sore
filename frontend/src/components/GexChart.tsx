"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { GexPoint, Levels } from "@/types";

interface Props {
  data: GexPoint[];
  spot: number;
  levels: Levels;
}

const fmt = (v: number) => `${(v / 1e9).toFixed(1)}B`;

export default function GexChart({ data, spot, levels }: Props) {
  const filtered = data.filter(
    (d) => d.strike >= spot * 0.88 && d.strike <= spot * 1.12
  );

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={filtered} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
        <XAxis
          dataKey="strike"
          tick={{ fill: "#888", fontSize: 10 }}
          tickFormatter={(v) => `$${v}`}
        />
        <YAxis
          tick={{ fill: "#888", fontSize: 10 }}
          tickFormatter={fmt}
        />
        <Tooltip
          contentStyle={{ background: "#161616", border: "1px solid #2a2a2a", color: "#e0e0e0" }}
          formatter={(v: number) => [`${(v / 1e9).toFixed(3)}B`, "GEX"]}
          labelFormatter={(l) => `Strike: $${l}`}
        />
        <ReferenceLine x={spot} stroke="#ffffff" strokeWidth={2} label={{ value: "SPOT", fill: "#fff", fontSize: 10 }} />
        <ReferenceLine x={levels.call_wall} stroke="#ff1744" strokeDasharray="4 4" label={{ value: "CW", fill: "#ff1744", fontSize: 9 }} />
        <ReferenceLine x={levels.put_wall} stroke="#448aff" strokeDasharray="4 4" label={{ value: "PW", fill: "#448aff", fontSize: 9 }} />
        <ReferenceLine x={levels.gamma_flip} stroke="#ffd740" strokeDasharray="4 4" label={{ value: "GF", fill: "#ffd740", fontSize: 9 }} />
        <Bar dataKey="gex" radius={[2, 2, 0, 0]}>
          {filtered.map((entry, index) => (
            <Cell key={index} fill={entry.gex >= 0 ? "#00e676" : "#ff1744"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
