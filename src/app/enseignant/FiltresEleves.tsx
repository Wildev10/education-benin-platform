"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { NIVEAUX, filtresElevesVersParams, type FiltresEleves as Filtres } from "@/lib/filtres-eleves";
import { urlListe, type TaillePage } from "@/lib/pagination";

const DELAI_RECHERCHE_MS = 300;

const selectCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark";

/**
 * Recherche et filtres de la liste des élèves, gardés dans l'URL. Tout
 * changement revient à la page 1 en conservant la taille de page.
 */
export function FiltresEleves({
  filtres,
  taille,
  etablissements,
  children,
}: {
  filtres: Filtres;
  taille: TaillePage;
  /** Fournie uniquement pour l'admin : les autres rôles ne voient que leur établissement */
  etablissements: { id: string; nom: string }[] | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [enCours, startTransition] = useTransition();
  const [courants, setCourants] = useOptimistic(filtres);

  // Même principe que les filtres des alertes : saisie libre, appliquée après une pause,
  // resynchronisée si l'URL change d'ailleurs (retour arrière).
  const [recherche, setRecherche] = useState(filtres.q ?? "");
  const [qServeur, setQServeur] = useState(filtres.q ?? "");
  if ((filtres.q ?? "") !== qServeur) {
    setQServeur(filtres.q ?? "");
    if ((filtres.q ?? "") !== recherche.trim()) setRecherche(filtres.q ?? "");
  }

  function naviguer(suivants: Filtres, mode: "push" | "replace" = "push") {
    const url = urlListe(pathname, filtresElevesVersParams(suivants), taille);
    startTransition(() => {
      setCourants(suivants);
      router[mode](url, { scroll: false });
    });
  }

  useEffect(() => {
    const q = recherche.trim();
    if (q === (courants.q ?? "")) return;
    const t = window.setTimeout(() => {
      naviguer({ ...courants, q: q || undefined }, "replace");
    }, DELAI_RECHERCHE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la saisie déclenche la recherche
  }, [recherche]);

  return (
    <>
      <div className="border-b border-border py-5">
        <div className="relative w-full max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition ${recherche ? "text-brand-dark" : "text-ink-secondary"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </span>
          <label htmlFor="search-etudiants" className="sr-only">
            Rechercher un étudiant
          </label>
          <input
            id="search-etudiants"
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher par nom ou prénom..."
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-9 text-sm text-ink transition placeholder:text-ink-secondary focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark"
          />
          {recherche && (
            <button
              type="button"
              onClick={() => setRecherche("")}
              aria-label="Effacer la recherche"
              className="absolute inset-y-0 right-3 flex items-center text-ink-secondary hover:text-ink"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className={`grid gap-4 border-b border-border py-5 ${etablissements ? "sm:grid-cols-2" : "sm:max-w-sm"}`}>
        {etablissements && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-etablissement" className="text-sm font-semibold text-ink">
              Établissement
            </label>
            <select
              id="filter-etablissement"
              value={courants.etablissement ?? ""}
              onChange={(e) => naviguer({ ...courants, etablissement: e.target.value || undefined })}
              className={selectCls}
            >
              <option value="">Tous les établissements</option>
              {etablissements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-niveau" className="text-sm font-semibold text-ink">
            Niveau
          </label>
          <select
            id="filter-niveau"
            value={courants.niveau ?? ""}
            onChange={(e) => naviguer({ ...courants, niveau: e.target.value || undefined })}
            className={selectCls}
          >
            <option value="">Tous les niveaux</option>
            {NIVEAUX.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div aria-busy={enCours} className={`transition-opacity ${enCours ? "opacity-60" : ""}`}>
        {children}
      </div>
    </>
  );
}
