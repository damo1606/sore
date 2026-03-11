"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface Props {
  prices: number[];
  flows: number[];
  spot: number;
  gammaFlip: number;
}

export default function DealerFlowChart({ prices, flows, spot, gammaFlip }: Props) {
  const chartData = prices.map((p, i) => ({
    price: parseFloat(p.toFixed(2)),
    flow: flows[i],
  }));

  const fmt = (v: number) => `${(v / 1e9).toFixed(1)}B`;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
        <XAxis
          dataKey="price"
          tick={{ fill: "#888", fontSize: 10 }}
          tickFormatter={(v) => `$${v}`}
        />
        <YAxis tick={{ fill: "#888", fontSize: 10 }} tickFormatter={fmt} />
        <Tooltip
          contentStyle={{ background: "#161616", border: "1px solid #2a2a2a", color: "#e0e0e0" }}
          formatter={(v: number) => [fmt(v), "Dealer Flow"]}
          labelFormatter={(l) => `Price: $${l}`}
        />
        <ReferenceLine x={spot} stroke="#ffffff" strokeWidth={2} />
        <ReferenceLine x={gammaFlip} stroke="#ffd740" strokeDasharray="4 4" />
        <ReferenceLine y={0} stroke="#444" />
        <Line
          type="monotone"
          dataKey="flow"
          stroke="#00e676"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
