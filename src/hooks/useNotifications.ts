"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  compterNonLues,
  fusionnerNotifications,
  type NotificationAlerte,
} from "@/lib/notifications";

const INTERVALLE_POLL_MS = 30_000;

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
 * Poll /api/notifications/alertes toutes les 30 s. L'état lu/non lu est conservé
 * en localStorage (par utilisateur) : une alerte est « lue » si elle a été créée
 * avant la dernière ouverture du dropdown.
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
    async function charger() {
      if (document.visibilityState === "hidden") return;
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

    void charger();
    const id = window.setInterval(charger, INTERVALLE_POLL_MS);
    return () => {
      annule = true;
      window.clearInterval(id);
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
