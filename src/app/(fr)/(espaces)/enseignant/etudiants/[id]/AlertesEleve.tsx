"use client";

import { Badge, riskVariant, statusVariant } from "@/components/ui/Badge";
import { BoutonTraiterAlerte } from "@/components/alertes/BoutonTraiterAlerte";
import { FUSEAU_BENIN } from "@/lib/dates";
import { texteComparaison } from "@/lib/message-saisie";
import type { ComparaisonNotes } from "@/lib/regles-alerte";

export type AlerteEleve = {
  id: string;
  type: string;
  niveauRisque: string;
  statut: string;
  periode: string;
  moyenneAvant: number;
  moyenneApres: number;
  ecartPourcent: number;
  createdAt: string;
};

function formaterNombre(valeur: number) {
  return valeur.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default function AlertesEleve({
  alertes,
  peutTraiter,
  comparaison,
  onTraitee,
}: {
  alertes: AlerteEleve[];
  /** Enseignant et admin : oui. Directeur : consultation seule. */
  peutTraiter: boolean;
  comparaison: ComparaisonNotes;
  onTraitee: (id: string) => void;
}) {
  const mention = texteComparaison(comparaison);

  return (
    <section aria-labelledby="alertes-eleve-titre">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">Suivi des risques</p>
      <h2 id="alertes-eleve-titre" className="mt-1 text-2xl font-bold text-ink">
        Historique des alertes
      </h2>
      {mention && (
        <p data-comparaison={comparaison.etat} className="mt-2 text-sm text-ink-secondary">
          {mention}
        </p>
      )}

      {alertes.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
          Aucune alerte pour cet élève.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {alertes.map((alerte) => (
            <article key={alerte.id} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={riskVariant(alerte.niveauRisque)}>
                    {alerte.niveauRisque === "eleve" ? "Risque élevé" : "Risque moyen"}
                  </Badge>
                  <Badge variant={statusVariant(alerte.statut)}>
                    {alerte.statut === "active" ? "Active" : "Traitée"}
                  </Badge>
                  <span className="text-sm font-semibold text-ink">{alerte.periode}</span>
                </div>
                {peutTraiter && alerte.statut === "active" && (
                  <BoutonTraiterAlerte alerteId={alerte.id} onTraitee={() => onTraitee(alerte.id)} />
                )}
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-3">
                <div>
                  <dt className="text-sm font-semibold text-ink-secondary">Type</dt>
                  <dd className="mt-1 font-semibold text-ink">
                    {alerte.type === "absences" ? "Absences" : "Notes"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-ink-secondary">
                    {alerte.type === "absences" ? "Absences injustifiées" : "Moyenne"}
                  </dt>
                  <dd className="mt-1 font-semibold tabular-nums">
                    {alerte.type === "absences" ? (
                      <span className="text-red-700">{alerte.moyenneApres}</span>
                    ) : (
                      <>
                        <span className="text-ink">{formaterNombre(alerte.moyenneAvant)}</span>
                        <span aria-hidden="true" className="mx-1 text-ink-secondary">→</span>
                        <span className="sr-only"> puis </span>
                        <span className="text-red-700">{formaterNombre(alerte.moyenneApres)}</span>
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-ink-secondary">Détectée le</dt>
                  <dd className="mt-1 font-semibold text-ink">
                    <time dateTime={alerte.createdAt}>
                      {new Date(alerte.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: FUSEAU_BENIN,
                      })}
                    </time>
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
