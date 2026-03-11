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
import { VannaPoint } from "@/types";

interface Props {
  data: VannaPoint[];
  spot: number;
}

export default function VannaChart({ data, spot }: Props) {
  const filtered = data.filter(
    (d) => d.strike >= spot * 0.88 && d.strike <= spot * 1.12
  );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={filtered} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
        <XAxis
          dataKey="strike"
          tick={{ fill: "#888", fontSize: 10 }}
          tickFormatter={(v) => `$${v}`}
        />
        <YAxis tick={{ fill: "#888", fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: "#161616", border: "1px solid #2a2a2a", color: "#e0e0e0" }}
          formatter={(v: number) => [v.toFixed(0), "Vanna"]}
          labelFormatter={(l) => `Strike: $${l}`}
        />
        <ReferenceLine x={spot} stroke="#ffffff" strokeWidth={2} />
        <ReferenceLine y={0} stroke="#444" />
        <Bar dataKey="vanna" radius={[2, 2, 0, 0]}>
          {filtered.map((entry, index) => (
            <Cell key={index} fill={entry.vanna >= 0 ? "#448aff" : "#ff6d00"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
