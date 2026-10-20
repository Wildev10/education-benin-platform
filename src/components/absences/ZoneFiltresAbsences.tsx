"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useOptimistic, useState, useTransition } from "react";
import {
  MOTIFS,
  PERIODES,
  filtresAbsencesVersParams,
  type FiltresAbsences,
  type Motif,
} from "@/lib/filtres-absences";
import { urlListe, type TaillePage } from "@/lib/pagination";

const DELAI_RECHERCHE_MS = 350;

const champCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark";
const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

/** Filtres de la liste des absences, gardés dans l'URL ; tout changement revient à la page 1. */
export function ZoneFiltresAbsences({
  filtres,
  taille,
  annees,
  etablissements,
  children,
}: {
  filtres: FiltresAbsences;
  taille: TaillePage;
  annees: string[];
  /** Fournie uniquement pour l'admin */
  etablissements: { id: string; nom: string }[] | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  const [enCours, startTransition] = useTransition();
  const [courants, setCourants] = useOptimistic(filtres);

  const [recherche, setRecherche] = useState(filtres.q ?? "");
  const [qServeur, setQServeur] = useState(filtres.q ?? "");
  if ((filtres.q ?? "") !== qServeur) {
    setQServeur(filtres.q ?? "");
    if ((filtres.q ?? "") !== recherche.trim()) setRecherche(filtres.q ?? "");
  }

  function naviguer(suivants: FiltresAbsences, mode: "push" | "replace" = "push") {
    const url = urlListe(pathname, filtresAbsencesVersParams(suivants), taille);
    startTransition(() => {
      setCourants(suivants);
      router[mode](url, { scroll: false });
    });
  }

  useEffect(() => {
    const q = recherche.trim();
    if (q === (courants.q ?? "")) return;
    const t = window.setTimeout(() => naviguer({ ...courants, q: q || undefined }, "replace"), DELAI_RECHERCHE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la saisie déclenche la recherche
  }, [recherche]);

  return (
    <div>
      <div
        role="search"
        aria-label="Filtres des absences"
        className="rounded-[14px] border border-border bg-surface p-4 shadow-sm sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor={`${id}-q`} className={labelCls}>Rechercher un élève</label>
            <input
              id={`${id}-q`}
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom ou prénom"
              autoComplete="off"
              className={`${champCls} placeholder:text-ink-secondary/50`}
            />
          </div>

          <div>
            <label htmlFor={`${id}-periode`} className={labelCls}>Période</label>
            <select
              id={`${id}-periode`}
              value={courants.periode ?? ""}
              onChange={(e) => naviguer({ ...courants, periode: e.target.value || undefined })}
              className={champCls}
            >
              <option value="">Toutes</option>
              {PERIODES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${id}-motif`} className={labelCls}>Motif</label>
            <select
              id={`${id}-motif`}
              value={courants.motif ?? ""}
              onChange={(e) => naviguer({ ...courants, motif: (e.target.value || undefined) as Motif | undefined })}
              className={champCls}
            >
              <option value="">Tous</option>
              {Object.entries(MOTIFS).map(([valeur, libelle]) => (
                <option key={valeur} value={valeur}>{libelle}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${id}-annee`} className={labelCls}>Année scolaire</label>
            <select
              id={`${id}-annee`}
              value={courants.annee ?? ""}
              onChange={(e) => naviguer({ ...courants, annee: e.target.value || undefined })}
              className={champCls}
            >
              <option value="">Toutes</option>
              {annees.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {etablissements && (
            <div>
              <label htmlFor={`${id}-etab`} className={labelCls}>Établissement</label>
              <select
                id={`${id}-etab`}
                value={courants.etablissement ?? ""}
                onChange={(e) => naviguer({ ...courants, etablissement: e.target.value || undefined })}
                className={champCls}
              >
                <option value="">Tous</option>
                {etablissements.map((e) => (
                  <option key={e.id} value={e.id}>{e.nom}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div aria-busy={enCours} className={`mt-6 transition-opacity ${enCours ? "opacity-60" : ""}`}>
        {children}
      </div>
    </div>
  );
}
