"use client";

import dynamic from "next/dynamic";
import type { MoyenneNiveau, PointEvolution } from "@/lib/tableau-de-bord-directeur";

const chargement = () => (
  <div className="h-64 w-full animate-pulse rounded-xl bg-page" aria-busy="true" />
);

const EvolutionMoyenneChart = dynamic(() => import("./EvolutionMoyenneChart"), {
  ssr: false,
  loading: chargement,
});

const MoyennesNiveauChart = dynamic(() => import("./MoyennesNiveauChart"), {
  ssr: false,
  loading: chargement,
});

export function GraphiqueEvolution({ data }: { data: PointEvolution[] }) {
  return <EvolutionMoyenneChart data={data} />;
}

export function GraphiqueNiveaux({ data }: { data: MoyenneNiveau[] }) {
  return <MoyennesNiveauChart data={data} />;
}
