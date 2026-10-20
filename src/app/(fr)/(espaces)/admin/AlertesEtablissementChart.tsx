"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { hauteurGraphiqueBarres } from "@/lib/graphiques";

type Point = { nom: string; nbAlertesActives: number };

export default function AlertesEtablissementChart({ data }: { data: Point[] }) {
  return (
    <div
      role="img"
      aria-label="Graphique du nombre d'alertes actives par établissement"
      style={{ height: hauteurGraphiqueBarres(data.length) }}
      className="w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#E5E5E5" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: "#6B6B6B", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="nom"
            width={140}
            tick={{ fill: "#404040", fontSize: 12 }}
            axisLine={{ stroke: "#E5E5E5" }}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "#FFF7ED" }}
            formatter={(value) => [value, "Alertes actives"]}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #E5E5E5",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          />
          <Bar dataKey="nbAlertesActives" fill="#F97316" barSize={20} radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="nbAlertesActives"
              position="right"
              style={{ fill: "#0A0A0A", fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
