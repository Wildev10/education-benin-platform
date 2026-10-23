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
import { useCouleursGraphique, type CouleursGraphique } from "@/lib/couleurs-graphiques";
import { hauteurGraphiqueBarres } from "@/lib/graphiques";
import { formaterNombre } from "@/lib/format";
import type { MoyenneNiveau } from "@/lib/tableau-de-bord-directeur";

function couleur(moyenne: number, c: CouleursGraphique) {
  if (moyenne >= 12) return c.bon;
  if (moyenne >= 10) return c.moyen;
  return c.faible;
}

export default function MoyennesNiveauChart({ data }: { data: MoyenneNiveau[] }) {
  const c = useCouleursGraphique();
  return (
    <div
      role="img"
      aria-label={`Moyenne par classe : ${data
        .map((d) => `${d.niveau} ${formaterNombre(d.moyenne, 2)} sur 20`)
        .join(", ")}`}
      style={{ height: hauteurGraphiqueBarres(data.length) }}
      className="w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={c.grille} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 20]}
            ticks={[0, 5, 10, 15, 20]}
            tick={{ fill: c.axe, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="niveau"
            width={96}
            tick={{ fill: c.libelle, fontSize: 12 }}
            axisLine={{ stroke: c.grille }}
            tickLine={false}
          />
          <ReferenceLine x={10} stroke={c.seuil} strokeDasharray="4 4" strokeOpacity={c.opaciteSeuil} />
          <Tooltip
            cursor={{ fill: c.survol }}
            formatter={(value, _name, item) => [
              `${formaterNombre(Number(value), 2)}/20 (${(item.payload as MoyenneNiveau).eleves} élèves)`,
              "Moyenne",
            ]}
            contentStyle={{
              borderRadius: "12px",
              border: `1px solid ${c.bordureInfobulle}`,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          />
          <Bar dataKey="moyenne" barSize={20} radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell key={d.niveau} fill={couleur(d.moyenne, c)} />
            ))}
            <LabelList
              dataKey="moyenne"
              position="right"
              formatter={(v) => formaterNombre(Number(v))}
              style={{ fill: c.valeur, fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
