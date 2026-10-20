"use client";

import dynamic from "next/dynamic";
import { SqueletteGraphiqueBarres, SqueletteGraphiqueLigne } from "@/components/ui/Squelette";
import { hauteurGraphiqueBarres } from "@/lib/graphiques";
import type { MoyenneNiveau, PointEvolution } from "@/lib/tableau-de-bord-directeur";

const EvolutionMoyenneChart = dynamic(() => import("./EvolutionMoyenneChart"), {
  ssr: false,
  loading: () => <SqueletteGraphiqueLigne className="h-64" />,
});

const MoyennesNiveauChart = dynamic(() => import("./MoyennesNiveauChart"), {
  ssr: false,
  loading: () => <SqueletteGraphiqueBarres className="h-full" />,
});

export function GraphiqueEvolution({ data }: { data: PointEvolution[] }) {
  return <EvolutionMoyenneChart data={data} />;
}

export function GraphiqueNiveaux({ data }: { data: MoyenneNiveau[] }) {
  // Hauteur réservée avant le chargement du graphique : le squelette la remplit
  return (
    <div style={{ height: hauteurGraphiqueBarres(data.length) }}>
      <MoyennesNiveauChart data={data} />
    </div>
  );
}
