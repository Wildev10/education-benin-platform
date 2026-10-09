"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartPoint = { periode: string; moyenne: number };

export default function MoyenneChart({ data }: { data: ChartPoint[] }) {
  return (
    <div
      aria-label="Graphique de l'évolution de la moyenne par trimestre"
      className="mt-6 h-72 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 24, bottom: 12, left: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#E5E5E5" vertical={false} />
          <XAxis
            dataKey="periode"
            tick={{ fill: "#404040", fontSize: 13 }}
            axisLine={{ stroke: "#E5E5E5" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 20]}
            ticks={[0, 5, 10, 15, 20]}
            tick={{ fill: "#6B6B6B", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(2)}/20`, "Moyenne"]}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #E5E5E5",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          />
          <Line
            type="monotone"
            dataKey="moyenne"
            name="Moyenne / 20"
            stroke="#F97316"
            strokeWidth={3}
            dot={{ r: 6, fill: "#fff", stroke: "#F97316", strokeWidth: 2.5 }}
            activeDot={{ r: 8, fill: "#C2410C", stroke: "#fff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
