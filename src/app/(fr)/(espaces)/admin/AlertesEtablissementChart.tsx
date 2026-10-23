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
import { useCouleursGraphique } from "@/lib/couleurs-graphiques";
import { hauteurGraphiqueBarres } from "@/lib/graphiques";

type Point = { nom: string; nbAlertesActives: number };

export default function AlertesEtablissementChart({ data }: { data: Point[] }) {
  const c = useCouleursGraphique();
  return (
    <div
      role="img"
      aria-label="Graphique du nombre d'alertes actives par établissement"
      style={{ height: hauteurGraphiqueBarres(data.length) }}
      className="w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={c.grille} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: c.axe, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="nom"
            width={140}
            tick={{ fill: c.libelle, fontSize: 12 }}
            axisLine={{ stroke: c.grille }}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: c.survol }}
            formatter={(value) => [value, "Alertes actives"]}
            contentStyle={{
              borderRadius: "12px",
              border: `1px solid ${c.bordureInfobulle}`,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          />
          <Bar dataKey="nbAlertesActives" fill={c.trait} barSize={20} radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="nbAlertesActives"
              position="right"
              style={{ fill: c.valeur, fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
