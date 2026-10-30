"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useOptimistic, useState, useTransition } from "react";
import { ExportExcelButton, ExportPdfButton } from "@/components/ExportPdfButton";
import {
  compterFiltresActifs,
  filtresVersParams,
  LIBELLES_FILTRE_STATUT,
  periodeIncoherente,
  type FiltresAlertes,
} from "@/lib/filtres-alertes";
import { urlListe, type TaillePage } from "@/lib/pagination";

const DELAI_RECHERCHE_MS = 350;

const champCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark";
const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

export function ZoneFiltresAlertes({
  filtres,
  taille,
  etablissements,
  mesSuivis = false,
  children,
}: {
  filtres: FiltresAlertes;
  /** Taille de page courante, conservée quand les filtres changent */
  taille: TaillePage;
  /** Liste des établissements : fournie uniquement pour l'admin */
  etablissements: { id: string; nom: string }[] | null;
  /** Filtre « Mes suivis » : enseignant et directeur (l'admin n'est responsable d'aucun suivi) */
  mesSuivis?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  const [enCours, startTransition] = useTransition();
  const [courants, setCourants] = useOptimistic(filtres);
  const [panneauOuvert, setPanneauOuvert] = useState(false);

  // La recherche est tapée librement puis appliquée après une courte pause.
  // Si l'URL change d'ailleurs (retour arrière, réinitialisation), on resynchronise.
  const [recherche, setRecherche] = useState(filtres.q ?? "");
  const [qServeur, setQServeur] = useState(filtres.q ?? "");
  if ((filtres.q ?? "") !== qServeur) {
    setQServeur(filtres.q ?? "");
    if ((filtres.q ?? "") !== recherche.trim()) setRecherche(filtres.q ?? "");
  }

  function naviguer(suivants: FiltresAlertes, mode: "push" | "replace" = "push") {
    // Nouveaux filtres : retour à la page 1, même taille de page
    const url = urlListe(pathname, filtresVersParams(suivants), taille);
    startTransition(() => {
      setCourants(suivants);
      router[mode](url, { scroll: false });
    });
  }

  function appliquer(partiel: Partial<FiltresAlertes>) {
    naviguer({ ...courants, ...partiel });
  }

  useEffect(() => {
    const q = recherche.trim();
    if (q === (courants.q ?? "")) return;
    const t = window.setTimeout(() => {
      // replace : une frappe ne doit pas créer une entrée d'historique par lettre
      naviguer({ ...courants, q: q || undefined }, "replace");
    }, DELAI_RECHERCHE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la saisie déclenche la recherche
  }, [recherche]);

  function reinitialiser() {
    setRecherche("");
    naviguer({ statut: "active" });
  }

  const nbFiltres = compterFiltresActifs(courants);
  const exportParams = filtresVersParams(courants).toString();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {/* Bouton d'ouverture du panneau : mobile uniquement */}
        <button
          type="button"
          aria-expanded={panneauOuvert}
          aria-controls={`${id}-panneau`}
          onClick={() => setPanneauOuvert((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark md:hidden"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Filtres
          {nbFiltres > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-xs font-bold text-ink">
              {nbFiltres}
              <span className="sr-only"> actif{nbFiltres > 1 ? "s" : ""}</span>
            </span>
          )}
        </button>
        {nbFiltres > 0 && (
          <button
            type="button"
            onClick={reinitialiser}
            className="rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-dark underline underline-offset-4 transition hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark"
          >
            Réinitialiser les filtres
          </button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <ExportPdfButton
            href={`/api/alertes/pdf${exportParams ? `?${exportParams}` : ""}`}
            label="Exporter en PDF"
            fichierParDefaut="alertes.pdf"
          />
          <ExportExcelButton
            href={`/api/alertes/xlsx${exportParams ? `?${exportParams}` : ""}`}
            fichierParDefaut="alertes.xlsx"
          />
        </div>
      </div>

      <div
        role="search"
        id={`${id}-panneau`}
        aria-label="Filtres des alertes"
        className={`${panneauOuvert ? "block" : "hidden"} mt-4 rounded-[14px] border border-border bg-surface p-4 shadow-sm sm:p-5 md:block`}
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
            <label htmlFor={`${id}-niveau`} className={labelCls}>Niveau de risque</label>
            <select
              id={`${id}-niveau`}
              value={courants.niveau ?? ""}
              onChange={(e) => appliquer({ niveau: (e.target.value || undefined) as FiltresAlertes["niveau"] })}
              className={champCls}
            >
              <option value="">Tous</option>
              <option value="eleve">Élevé</option>
              <option value="moyen">Moyen</option>
            </select>
          </div>

          <div>
            <label htmlFor={`${id}-type`} className={labelCls}>Type</label>
            <select
              id={`${id}-type`}
              value={courants.type ?? ""}
              onChange={(e) => appliquer({ type: (e.target.value || undefined) as FiltresAlertes["type"] })}
              className={champCls}
            >
              <option value="">Tous</option>
              <option value="notes">Notes</option>
              <option value="absences">Absences</option>
            </select>
          </div>

          <div>
            <label htmlFor={`${id}-statut`} className={labelCls}>Statut</label>
            <select
              id={`${id}-statut`}
              value={courants.statut}
              onChange={(e) => appliquer({ statut: e.target.value as FiltresAlertes["statut"] })}
              className={champCls}
            >
              {(Object.keys(LIBELLES_FILTRE_STATUT) as FiltresAlertes["statut"][]).map((statut) => (
                <option key={statut} value={statut}>{LIBELLES_FILTRE_STATUT[statut]}</option>
              ))}
            </select>
          </div>

          {mesSuivis && (
            <div>
              <label htmlFor={`${id}-suivi`} className={labelCls}>Responsable</label>
              <select
                id={`${id}-suivi`}
                value={courants.suivi ?? ""}
                onChange={(e) => appliquer({ suivi: e.target.value === "moi" ? "moi" : undefined })}
                className={champCls}
              >
                <option value="">Tous les suivis</option>
                <option value="moi">Mes suivis</option>
              </select>
            </div>
          )}

          {etablissements && (
            <div>
              <label htmlFor={`${id}-etab`} className={labelCls}>Établissement</label>
              <select
                id={`${id}-etab`}
                value={courants.etablissement ?? ""}
                onChange={(e) => appliquer({ etablissement: e.target.value || undefined })}
                className={champCls}
              >
                <option value="">Tous</option>
                {etablissements.map((e) => (
                  <option key={e.id} value={e.id}>{e.nom}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor={`${id}-du`} className={labelCls}>Créées à partir du</label>
            <input
              id={`${id}-du`}
              type="date"
              value={courants.du ?? ""}
              max={courants.au}
              onChange={(e) => appliquer({ du: e.target.value || undefined })}
              className={champCls}
            />
          </div>

          <div>
            <label htmlFor={`${id}-au`} className={labelCls}>Jusqu&apos;au</label>
            <input
              id={`${id}-au`}
              type="date"
              value={courants.au ?? ""}
              min={courants.du}
              onChange={(e) => appliquer({ au: e.target.value || undefined })}
              className={champCls}
            />
          </div>
        </div>

        {periodeIncoherente(courants) && (
          <p role="alert" className="mt-4 text-sm font-medium text-red-700">
            La date de début est postérieure à la date de fin : aucune alerte ne peut correspondre.
          </p>
        )}
      </div>

      <div aria-busy={enCours} className={`mt-6 transition-opacity ${enCours ? "opacity-60" : ""}`}>
        {children}
      </div>
    </div>
  );
}
