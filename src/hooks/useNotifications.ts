"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  compterNonLues,
  fusionnerNotifications,
  type NotificationAlerte,
} from "@/lib/notifications";

const INTERVALLE_POLL_MS = 60_000;

type EtatStocke = { dernierVu: string | null; notifications: NotificationAlerte[] };

function lireStockage(cle: string): EtatStocke {
  try {
    const brut = localStorage.getItem(cle);
    if (brut) {
      const parse = JSON.parse(brut) as Partial<EtatStocke>;
      return {
        dernierVu: typeof parse.dernierVu === "string" ? parse.dernierVu : null,
        notifications: Array.isArray(parse.notifications) ? parse.notifications : [],
      };
    }
  } catch {
    // localStorage indisponible (navigation privée…) : on repart d'un état vide
  }
  return { dernierVu: null, notifications: [] };
}

function ecrireStockage(cle: string, etat: EtatStocke) {
  try {
    localStorage.setItem(cle, JSON.stringify(etat));
  } catch {
    // ignoré
  }
}

/**
 * Poll /api/notifications/alertes toutes les 60 s, seulement quand l'onglet est
 * visible, et au retour sur l'onglet si le dernier appel date de plus de 60 s. L'état lu/non lu est conservé
 * en localStorage (par utilisateur) : une notification est « lue » si son
 * événement (création, ou aggravation Moyen → Élevé) précède la dernière
 * ouverture du dropdown. Une aggravation redevient donc non lue.
 */
export function useNotifications(utilisateur: string, actif = true) {
  const cle = `edutech:notifications:${utilisateur}`;
  const [etat, setEtat] = useState<EtatStocke>({ dernierVu: null, notifications: [] });
  // localStorage n'existe pas côté serveur : on l'intègre à la première mise à jour client
  const hydrate = useRef(false);
  const hydrater = useCallback((): EtatStocke | null => {
    if (hydrate.current) return null;
    hydrate.current = true;
    return lireStockage(cle);
  }, [cle]);

  useEffect(() => {
    if (!actif) return;

    let annule = false;
    let dernierAppel = 0;
    async function charger() {
      if (document.visibilityState === "hidden") return;
      dernierAppel = Date.now();
      try {
        const res = await fetch("/api/notifications/alertes", { cache: "no-store" });
        if (!res.ok) return;
        const nouvelles = (await res.json()) as NotificationAlerte[];
        if (annule) return;
        const stocke = hydrater();
        setEtat((prev) => {
          const courant = stocke ?? prev;
          const suivant = {
            ...courant,
            notifications: fusionnerNotifications(courant.notifications, nouvelles),
          };
          ecrireStockage(cle, suivant);
          return suivant;
        });
      } catch {
        // erreur réseau : on réessaiera au prochain tick
      }
    }

    function auRetourSurLOnglet() {
      if (document.visibilityState === "visible" && Date.now() - dernierAppel >= INTERVALLE_POLL_MS) void charger();
    }

    void charger();
    const id = window.setInterval(charger, INTERVALLE_POLL_MS);
    document.addEventListener("visibilitychange", auRetourSurLOnglet);
    return () => {
      annule = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", auRetourSurLOnglet);
    };
  }, [cle, actif, hydrater]);

  const marquerCommeLues = useCallback(() => {
    const stocke = hydrater();
    const dernierVu = new Date().toISOString();
    setEtat((prev) => {
      const suivant = { ...(stocke ?? prev), dernierVu };
      ecrireStockage(cle, suivant);
      return suivant;
    });
  }, [cle, hydrater]);

  return {
    notifications: etat.notifications,
    nonLues: compterNonLues(etat.notifications, etat.dernierVu),
    dernierVu: etat.dernierVu,
    marquerCommeLues,
  };
}
