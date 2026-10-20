"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { hauteurGraphiqueBarres } from "@/lib/graphiques";
import type { MoyenneNiveau } from "@/lib/tableau-de-bord-directeur";

function couleur(moyenne: number) {
  if (moyenne >= 12) return "#10B981";
  if (moyenne >= 10) return "#F97316";
  return "#DC2626";
}

export default function MoyennesNiveauChart({ data }: { data: MoyenneNiveau[] }) {
  return (
    <div
      role="img"
      aria-label={`Moyenne par classe : ${data
        .map((d) => `${d.niveau} ${d.moyenne.toLocaleString("fr-FR")} sur 20`)
        .join(", ")}`}
      style={{ height: hauteurGraphiqueBarres(data.length) }}
      className="w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#E5E5E5" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 20]}
            ticks={[0, 5, 10, 15, 20]}
            tick={{ fill: "#6B6B6B", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="niveau"
            width={96}
            tick={{ fill: "#404040", fontSize: 12 }}
            axisLine={{ stroke: "#E5E5E5" }}
            tickLine={false}
          />
          <ReferenceLine x={10} stroke="#B91C1C" strokeDasharray="4 4" strokeOpacity={0.5} />
          <Tooltip
            cursor={{ fill: "#FFF7ED" }}
            formatter={(value, _name, item) => [
              `${Number(value).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/20 (${(item.payload as MoyenneNiveau).eleves} élèves)`,
              "Moyenne",
            ]}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #E5E5E5",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          />
          <Bar dataKey="moyenne" barSize={20} radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell key={d.niveau} fill={couleur(d.moyenne)} />
            ))}
            <LabelList
              dataKey="moyenne"
              position="right"
              formatter={(v) => Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              style={{ fill: "#0A0A0A", fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
