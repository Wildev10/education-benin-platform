"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useHorsLigne } from "@/components/pwa/PwaProvider";
import { TITRE_HORS_LIGNE } from "@/components/pwa/BandeauHorsLigne";
import { formaterIlYA, libelleMiseAJour } from "@/lib/mise-a-jour";

/** Actualisation automatique : toutes les 5 minutes, onglet visible. */
const INTERVALLE = 5 * 60 * 1000;
/** Retour sur l'onglet : actualisation immédiate, sauf si la dernière date de moins de 30 s. */
const DELAI_RETOUR = 30 * 1000;
/** Pas de l'horloge de « il y a 5 min » */
const PAS_HORLOGE = 15 * 1000;

function abonnerHorloge(rappel: () => void) {
  const minuteur = window.setInterval(rappel, PAS_HORLOGE);
  document.addEventListener("visibilitychange", rappel);
  return () => {
    window.clearInterval(minuteur);
    document.removeEventListener("visibilitychange", rappel);
  };
}
const instantNavigateur = () => Math.floor(Date.now() / PAS_HORLOGE) * PAS_HORLOGE;
// Rendu serveur et hydratation : pas d'horloge, les données sont « à l'instant »
const instantServeur = () => null;

/**
 * Ligne d'information sous le titre d'un tableau de bord :
 * « Tous les établissements · Mis à jour à 10 h 28 · il y a 5 min · Actualiser ».
 * Les données sont rechargées sans recharger la page (router.refresh : seuls
 * les composants serveur sont recalculés, l'état et le défilement sont gardés).
 */
export function MiseAJourDonnees({ perimetre, misAJourLe }: {
  /** Périmètre des données, omis quand le titre le donne déjà */
  perimetre?: string;
  /** Instant du calcul des données (ISO), fourni par la page serveur */
  misAJourLe: string;
}) {
  const router = useRouter();
  const horsLigne = useHorsLigne();
  const [enCours, demarrer] = useTransition();
  const [manuelle, setManuelle] = useState(false);
  // Instant (horloge du navigateur) de la dernière actualisation : le rythme ne
  // dépend pas d'un éventuel décalage entre l'horloge du serveur et celle du poste.
  const derniere = useRef(0);
  const instant = useSyncExternalStore(abonnerHorloge, instantNavigateur, instantServeur);

  const date = new Date(misAJourLe);
  const maintenant = instant === null ? date : new Date(instant);
  const heure = libelleMiseAJour(date, maintenant);

  const actualiser = useCallback(() => {
    derniere.current = Date.now();
    demarrer(() => router.refresh());
  }, [router]);

  useEffect(() => {
    if (horsLigne) return;
    if (derniere.current === 0) derniere.current = Date.now();
    let minuteur: number | undefined;
    const ecoule = () => Date.now() - derniere.current;
    const automatique = () => {
      setManuelle(false);
      actualiser();
    };
    function planifier() {
      window.clearTimeout(minuteur);
      if (document.visibilityState !== "visible") return;
      minuteur = window.setTimeout(automatique, Math.max(0, INTERVALLE - ecoule()));
    }
    function auChangementDeVisibilite() {
      if (document.visibilityState === "visible" && ecoule() >= DELAI_RETOUR) automatique();
      else planifier();
    }
    planifier();
    document.addEventListener("visibilitychange", auChangementDeVisibilite);
    return () => {
      window.clearTimeout(minuteur);
      document.removeEventListener("visibilitychange", auChangementDeVisibilite);
    };
    // misAJourLe : nouvelles données reçues, le prochain passage est replanifié
  }, [misAJourLe, horsLigne, actualiser]);

  function auClic() {
    if (enCours || horsLigne) return;
    setManuelle(true);
    actualiser();
  }

  return (
    <div data-mise-a-jour className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-secondary">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {perimetre && (
          <>
            <span className="font-medium text-ink">{perimetre}</span>
            {/* Sur mobile, le périmètre a sa propre ligne : pas de point en bout de ligne */}
            <span aria-hidden="true" className="hidden text-border sm:inline">·</span>
          </>
        )}
        {/* Heure et ancienneté ne sont jamais séparées par un retour à la ligne */}
        <span className="whitespace-nowrap">
          Mis à jour{" "}
          <time dateTime={misAJourLe} title="Heure du Bénin" className="font-medium tabular-nums text-ink">
            {heure}
          </time>
          <span className="sr-only">, heure du Bénin</span>
          {" "}
          <span aria-hidden="true" className="px-1 text-border">·</span>{" "}
          <span className="tabular-nums">{formaterIlYA(date, maintenant)}</span>
        </span>
      </p>
      <button
        type="button"
        onClick={auClic}
        aria-disabled={enCours || horsLigne}
        aria-busy={enCours}
        title={horsLigne ? TITRE_HORS_LIGNE : undefined}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 font-semibold text-ink transition hover:border-brand hover:bg-brand-light aria-disabled:cursor-not-allowed aria-disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 tactile:min-h-11"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 ${enCours ? "motion-safe:animate-spin" : ""}`}
        >
          <path d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M13.5 2.5v3h-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Actualiser
      </button>
      {/* Annonce aux lecteurs d'écran, seulement après un clic : l'actualisation automatique reste silencieuse */}
      <span role="status" className="sr-only">
        {manuelle && !enCours ? `Données mises à jour ${heure}.` : ""}
      </span>
    </div>
  );
}
