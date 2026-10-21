import { useId, type ReactNode } from "react";

/** Bloc d'une année scolaire (absences par trimestre…), avec son titre h3. */
export function BlocAnnee({
  anneeScolaire,
  enCours,
  resume,
  children,
}: {
  anneeScolaire: string;
  /** Année scolaire en cours : signalée « (en cours) » */
  enCours: string;
  /** Texte à droite du titre (total de l'année…) */
  resume?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-annee={anneeScolaire}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={id} className="text-lg font-semibold text-ink">
          Année scolaire {anneeScolaire}
          {anneeScolaire === enCours && <span className="ml-2 text-sm font-medium text-ink-secondary">(en cours)</span>}
        </h3>
        {resume && <p className="text-sm font-medium text-ink-secondary tabular-nums">{resume}</p>}
      </div>
      {children}
    </section>
  );
}
