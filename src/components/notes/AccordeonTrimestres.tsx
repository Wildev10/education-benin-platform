"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { BlocAnnee } from "@/components/notes/BlocAnnee";
import { formaterNombre, formaterNote } from "@/lib/format";
import { cleTrimestre, type GroupeAnnee, type PeriodeScolaire } from "@/lib/notes-trimestres";

/**
 * Notes par année scolaire (la plus récente d'abord) puis par trimestre, en
 * accordéon. Chaque en-tête de trimestre est un bouton (aria-expanded,
 * aria-controls) qui garde la moyenne visible même replié ; seul le trimestre
 * en cours est ouvert au premier rendu, y compris côté serveur, sans saut de
 * mise en page à l'hydratation. Clavier : Entrée et Espace ouvrent ou replient,
 * flèches haut et bas, Début et Fin passent d'un en-tête à l'autre, toutes
 * années confondues.
 */
export function AccordeonTrimestres({
  annees,
  enCours,
  notesColorees = true,
  derniereSaisie = null,
  libelleVide = "Aucune note pour cette période.",
}: {
  annees: GroupeAnnee[];
  /** Trimestre en cours au Bénin : le seul ouvert par défaut */
  enCours: PeriodeScolaire;
  /** Fond vert ou rouge selon que la note atteint 10/20 */
  notesColorees?: boolean;
  /** Note qui vient d'être saisie : son trimestre s'ouvre s'il était replié */
  derniereSaisie?: ({ id: string } & PeriodeScolaire) | null;
  libelleVide?: string;
}) {
  const base = useId();
  const [ouverts, setOuverts] = useState<ReadonlySet<string>>(() => new Set([cleTrimestre(enCours)]));

  // Ajustement pendant le rendu plutôt qu'un effet : pas de rendu intermédiaire replié
  const [saisieVue, setSaisieVue] = useState(derniereSaisie?.id);
  if (derniereSaisie && derniereSaisie.id !== saisieVue) {
    setSaisieVue(derniereSaisie.id);
    const cle = cleTrimestre(derniereSaisie);
    if (!ouverts.has(cle)) setOuverts(new Set(ouverts).add(cle));
  }

  function basculer(cle: string) {
    setOuverts((courants) => {
      const suivants = new Set(courants);
      if (!suivants.delete(cle)) suivants.add(cle);
      return suivants;
    });
  }

  function naviguer(event: KeyboardEvent<HTMLDivElement>) {
    const entetes = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-entete-trimestre]"));
    const actuel = entetes.indexOf(document.activeElement as HTMLButtonElement);
    if (actuel === -1) return;
    const cible = {
      ArrowDown: (actuel + 1) % entetes.length,
      ArrowUp: (actuel - 1 + entetes.length) % entetes.length,
      Home: 0,
      End: entetes.length - 1,
    }[event.key];
    if (cible === undefined) return;
    event.preventDefault();
    entetes[cible].focus();
  }

  return (
    <div className="space-y-8" onKeyDown={naviguer}>
      {annees.map((annee, a) => (
        <BlocAnnee
          key={annee.anneeScolaire}
          anneeScolaire={annee.anneeScolaire}
          enCours={enCours.anneeScolaire}
          resume={annee.moyenne !== null ? `Moyenne annuelle : ${formaterNombre(annee.moyenne)}/20` : "Aucune note cette année"}
        >
          <div className="space-y-3">
            {annee.trimestres.map(({ periode, notes, moyenne }, i) => {
              const cle = cleTrimestre({ anneeScolaire: annee.anneeScolaire, periode });
              const ouvert = ouverts.has(cle);
              const idBouton = `${base}-entete-${a}-${i}`;
              const idPanneau = `${base}-panneau-${a}-${i}`;
              return (
                <section key={periode} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
                  <h4>
                    <button
                      type="button"
                      id={idBouton}
                      data-entete-trimestre={cle}
                      aria-expanded={ouvert}
                      aria-controls={idPanneau}
                      onClick={() => basculer(cle)}
                      className="flex min-h-14 w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-ink px-5 py-3 text-left text-surface transition hover:bg-ink-secondary focus-visible:outline-brand focus-visible:-outline-offset-4"
                    >
                      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <span className="flex items-center gap-2.5 font-semibold">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                            className={`shrink-0 self-center transition-transform ${ouvert ? "rotate-90" : ""}`}
                          >
                            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {periode}
                        </span>
                        <span className="text-sm font-medium text-surface/75">
                          {notes.length} note{notes.length > 1 ? "s" : ""}
                        </span>
                      </span>
                      {moyenne !== null ? (
                        <span className="shrink-0 rounded-full bg-brand px-3 py-1 text-sm font-bold text-ink tabular-nums">
                          <span className="sr-only">Moyenne : </span>
                          {formaterNombre(moyenne)}/20
                        </span>
                      ) : (
                        <span className="shrink-0 text-sm font-medium text-surface/75">Pas de moyenne</span>
                      )}
                    </button>
                  </h4>
                  <div id={idPanneau} role="region" aria-labelledby={idBouton} hidden={!ouvert}>
                    {notes.length > 0 ? (
                      <ul className="-mb-px grid gap-x-10 px-5 sm:grid-cols-2">
                        {notes.map((note) => (
                          <li key={note.id} className="flex items-center justify-between gap-4 border-b border-border py-3">
                            <span className="font-medium text-ink-secondary">{note.matiere}</span>
                            <span
                              className={
                                notesColorees
                                  ? `rounded-lg px-3 py-0.5 text-sm font-bold tabular-nums ${
                                      note.valeur >= 10 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                                    }`
                                  : "font-semibold tabular-nums text-ink"
                              }
                            >
                              {formaterNote(note.valeur)}/20
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-5 py-5 text-sm text-ink-secondary">{libelleVide}</p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </BlocAnnee>
      ))}
    </div>
  );
}
