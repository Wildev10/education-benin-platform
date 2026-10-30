"use client";

import { Badge, riskVariant, statusVariant } from "@/components/ui/Badge";
import { FormulaireSuivi, type Candidat } from "@/components/alertes/FormulaireSuivi";
import { HistoriqueSuivi } from "@/components/alertes/HistoriqueSuivi";
import { ResponsableEtMotif } from "@/components/alertes/ResponsableEtMotif";
import { FUSEAU_BENIN } from "@/lib/dates";
import { texteComparaison } from "@/lib/message-saisie";
import { libellePeriode } from "@/lib/notes-trimestres";
import { formaterNombre } from "@/lib/format";
import type { ComparaisonNotes } from "@/lib/regles-alerte";
import { suggestionCloture, type EtapeSuivi } from "@/lib/suivi-alertes";

export type AlerteEleve = {
  id: string;
  type: string;
  niveauRisque: string;
  statut: string;
  suiviDepuis: string | null;
  periode: string;
  anneeScolaire: string | null;
  moyenneAvant: number;
  moyenneApres: number;
  ecartPourcent: number;
  createdAt: string;
  suivis: EtapeSuivi[];
  motifCloture: string | null;
  responsable: { id: string; nom: string } | null;
};

export default function AlertesEleve({
  alertes,
  peutTraiter,
  comparaison,
  notes,
  absences,
  periodeEnCours,
  candidats = [],
  utilisateurId,
  onMiseAJour,
}: {
  alertes: AlerteEleve[];
  /** Enseignant et directeur de l'établissement. Admin : consultation seule. */
  peutTraiter: boolean;
  comparaison: ComparaisonNotes;
  /** Notes et absences de la fiche : servent à la suggestion de clôture */
  notes: { valeur: number; periode: string; anneeScolaire: string }[];
  absences: { motif: string; periode: string; anneeScolaire: string }[];
  /** Trimestre en cours au Bénin, calculé côté serveur (même rendu des deux côtés) */
  periodeEnCours: { anneeScolaire: string; periode: string };
  /** Responsables possibles : enseignants et directeur de l'établissement de l'élève */
  candidats?: Candidat[];
  utilisateurId?: string;
  onMiseAJour?: (alerte: AlerteEleve) => void;
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
          {alertes.map((alerte) => {
            const suggestion = suggestionCloture(alerte, notes, absences, periodeEnCours);
            return (
              <article
                key={alerte.id}
                id={`alerte-${alerte.id}`}
                data-alerte={alerte.id}
                className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={riskVariant(alerte.niveauRisque)}>
                    {alerte.niveauRisque === "eleve" ? "Risque élevé" : "Risque moyen"}
                  </Badge>
                  <Badge variant={statusVariant(alerte)} />
                  <span className="text-sm font-semibold text-ink">{libellePeriode(alerte.periode, alerte.anneeScolaire)}</span>
                </div>
                <ResponsableEtMotif alerte={alerte} />
                <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-border pt-5 min-[360px]:grid-cols-2 sm:grid-cols-3">
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

                {suggestion && (
                  <p
                    data-suggestion-cloture
                    className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
                  >
                    <strong>Clôture suggérée.</strong> {suggestion}
                  </p>
                )}

                <HistoriqueSuivi etapes={alerte.suivis} />

                {peutTraiter && onMiseAJour && (
                  <FormulaireSuivi
                    alerte={alerte}
                    candidats={candidats}
                    utilisateurId={utilisateurId}
                    onMiseAJour={(maj) => onMiseAJour({ ...alerte, ...maj })}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
