"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { accueilDuRole } from "@/lib/accueil";
import { empreinteUtilisateur, messageServiceWorker } from "@/lib/pwa";

/**
 * Rendu dans l'en-tête des pages connectées :
 * - indique au service worker qui est connecté (il vide le cache si le compte
 *   change) et quelle est sa page d'accueil ;
 * - lui signale chaque page visitée pour qu'il en garde une copie hors ligne
 *   (les navigations côté client ne passent pas par une requête HTML).
 */
export function SynchroUtilisateurPwa({ identifiant, role }: { identifiant: string; role?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const identifie = useRef(false);
  const empreinte = identifiant ? empreinteUtilisateur(identifiant) : "";
  const recherche = searchParams.toString();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !empreinte) return;
    const url = `${window.location.origin}${pathname}${recherche ? `?${recherche}` : ""}`;
    if (!identifie.current) {
      // Premier rendu : identification, puis mémorisation de la page courante
      identifie.current = true;
      void messageServiceWorker(
        { type: "UTILISATEUR", id: empreinte, url, accueil: accueilDuRole(role) ?? undefined },
        { attendre: true }
      );
      return;
    }
    void messageServiceWorker({ type: "MEMORISER_PAGE", url });
  }, [empreinte, role, pathname, recherche]);

  return null;
}
