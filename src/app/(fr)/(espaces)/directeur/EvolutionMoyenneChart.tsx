"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCouleursGraphique } from "@/lib/couleurs-graphiques";
import type { PointEvolution } from "@/lib/tableau-de-bord-directeur";
import { formaterNombre } from "@/lib/format";

/** Sous cette largeur, « Trimestre 1 » devient « T1 » : les trois étiquettes ne tiennent plus côte à côte. */
const LARGEUR_ETIQUETTES_COURTES = 300;

export default function EvolutionMoyenneChart({ data }: { data: PointEvolution[] }) {
  const c = useCouleursGraphique();
  const [etroit, setEtroit] = useState(false);
  return (
    <div
      role="img"
      aria-label={`Évolution de la moyenne de l'établissement : ${data
        .map((p) => `${p.periode} ${formaterNombre(p.moyenne, 2)} sur 20`)
        .join(", ")}`}
      className="h-64 w-full"
    >
      <ResponsiveContainer width="100%" height="100%" onResize={(largeur) => setEtroit(largeur < LARGEUR_ETIQUETTES_COURTES)}>
        <LineChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke={c.grille} vertical={false} />
          <XAxis
            dataKey="periode"
            interval={0}
            padding={{ left: 28, right: 28 }}
            tick={{ fill: c.libelle, fontSize: 12 }}
            tickFormatter={(periode: string) => (etroit ? periode.replace(/^Trimestre\s*/, "T") : periode)}
            axisLine={{ stroke: c.grille }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 20]}
            ticks={[0, 5, 10, 15, 20]}
            tick={{ fill: c.axe, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <ReferenceLine y={10} stroke={c.seuil} strokeDasharray="4 4" strokeOpacity={c.opaciteSeuil} />
          <Tooltip
            formatter={(value) => [`${formaterNombre(Number(value), 2)}/20`, "Moyenne"]}
            contentStyle={{
              borderRadius: "12px",
              border: `1px solid ${c.bordureInfobulle}`,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          />
          <Line
            type="monotone"
            dataKey="moyenne"
            name="Moyenne / 20"
            stroke={c.trait}
            strokeWidth={3}
            dot={{ r: 6, fill: "#fff", stroke: c.trait, strokeWidth: 2.5 }}
            activeDot={{ r: 8, fill: c.pointActif, stroke: "#fff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
