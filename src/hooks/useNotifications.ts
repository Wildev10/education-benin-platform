"use client";

import { useCallback, useEffect, useState } from "react";
import { compterNonLues, type EtatNotifications } from "@/lib/notifications";

const INTERVALLE_POLL_MS = 60_000;

/**
 * Poll /api/notifications/alertes toutes les 60 s, seulement quand l'onglet est
 * visible, et au retour sur l'onglet si le dernier appel date de plus de 60 s.
 * L'état lu/non lu est enregistré côté serveur pour l'utilisateur : ouvrir la
 * cloche sur un appareil marque les alertes comme lues sur tous les autres.
 */
export function useNotifications(utilisateur: string, actif = true) {
  const [etat, setEtat] = useState<EtatNotifications>({ notifications: [], vuesLe: null });

  useEffect(() => {
    if (!actif) return;

    // Ancien état lu/non lu gardé dans le navigateur : remplacé par celui du serveur
    try {
      localStorage.removeItem(`edutech:notifications:${utilisateur}`);
    } catch {
      // localStorage indisponible : rien à nettoyer
    }

    let annule = false;
    let dernierAppel = 0;
    async function charger() {
      if (document.visibilityState === "hidden") return;
      dernierAppel = Date.now();
      try {
        const res = await fetch("/api/notifications/alertes", { cache: "no-store" });
        if (!res.ok) return;
        const recu = (await res.json()) as EtatNotifications;
        if (!annule) setEtat(recu);
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
  }, [utilisateur, actif]);

  /** Marque comme lues les alertes affichées (jusqu'à la plus récente). */
  const marquerCommeLues = useCallback(async () => {
    const plusRecente = etat.notifications[0]?.date;
    if (!plusRecente || (etat.vuesLe && etat.vuesLe >= plusRecente)) return;
    setEtat((prev) => ({ ...prev, vuesLe: plusRecente }));
    try {
      const res = await fetch("/api/notifications/alertes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jusquA: plusRecente }),
      });
      if (!res.ok) return;
      const { vuesLe } = (await res.json()) as { vuesLe: string | null };
      setEtat((prev) => ({ ...prev, vuesLe }));
    } catch {
      // hors ligne : le prochain appel rétablit l'état du serveur, la prochaine ouverture réessaiera
    }
  }, [etat]);

  return {
    notifications: etat.notifications,
    nonLues: compterNonLues(etat.notifications, etat.vuesLe),
    vuesLe: etat.vuesLe,
    marquerCommeLues,
  };
}
