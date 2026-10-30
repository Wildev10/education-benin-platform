import { LIBELLES_MOTIF, statutSuivi } from "@/lib/suivi-alertes";

type AlerteSuivie = {
  statut: string;
  suiviDepuis: Date | string | null;
  motifCloture: string | null;
  responsable: { nom: string } | null;
};

/** Responsable du suivi (ou « à désigner ») et, pour une alerte clôturée, le motif. */
export function ResponsableEtMotif({ alerte }: { alerte: AlerteSuivie }) {
  const statut = statutSuivi(alerte);
  if (statut === "nouvelle" && !alerte.responsable) return null;
  const motif = alerte.motifCloture ? LIBELLES_MOTIF[alerte.motifCloture] ?? alerte.motifCloture : "non renseigné";
  const parties = [
    ...(statut !== "resolue" ? [["Responsable du suivi", alerte.responsable?.nom ?? "à désigner"]] : []),
    ...(statut === "resolue" && alerte.responsable ? [["Suivi par", alerte.responsable.nom]] : []),
    ...(statut === "resolue" ? [["Motif de clôture", motif]] : []),
  ];
  return (
    <p data-responsable className="mt-3 text-sm text-ink-secondary">
      {parties.map(([libelle, valeur], i) => (
        <span key={libelle}>
          {i > 0 && " · "}
          {libelle} : <span className="font-semibold text-ink">{valeur}</span>
        </span>
      ))}
    </p>
  );
}
