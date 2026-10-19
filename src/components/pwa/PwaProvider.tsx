"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { messageServiceWorker, PREFIXE_CACHES } from "@/lib/pwa";

type EvenementInstallation = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type ContextePwa = {
  /** Vrai si le navigateur est hors ligne ou si le service worker a dû servir le cache. */
  horsLigne: boolean;
  /** Le navigateur propose l'installation de l'application. */
  installationDisponible: boolean;
  installer: () => Promise<void>;
};

const Contexte = createContext<ContextePwa>({
  horsLigne: false,
  installationDisponible: false,
  installer: async () => {},
});

export function usePwa() {
  return useContext(Contexte);
}

export function useHorsLigne() {
  return useContext(Contexte).horsLigne;
}

const ACTIF = process.env.NODE_ENV === "production";
const VERSION = process.env.NEXT_PUBLIC_VERSION_APP ?? "0";

function abonnementReseau(rappel: () => void) {
  window.addEventListener("online", rappel);
  window.addEventListener("offline", rappel);
  return () => {
    window.removeEventListener("online", rappel);
    window.removeEventListener("offline", rappel);
  };
}

async function proposerRechargement(worker: ServiceWorker) {
  // Chargé seulement quand une mise à jour est disponible
  const { Swal } = await import("@/lib/swal");
  void Swal.fire({
    toast: true,
    position: "bottom-end",
    icon: "info",
    title: "Une nouvelle version d'EduTech est disponible.",
    showConfirmButton: true,
    confirmButtonText: "Recharger",
    confirmButtonColor: "#F97316",
    showCancelButton: true,
    cancelButtonText: "Plus tard",
    customClass: { popup: "swal-toast-custom" },
  }).then((r) => {
    if (r.isConfirmed) worker.postMessage({ type: "SKIP_WAITING" });
  });
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const navigateurEnLigne = useSyncExternalStore(abonnementReseau, () => navigator.onLine, () => true);
  const [cacheServi, setCacheServi] = useState(false);
  const [evenementInstallation, setEvenementInstallation] = useState<EvenementInstallation | null>(null);

  // Enregistrement du service worker : production uniquement
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (!ACTIF) {
      // En développement, on retire tout service worker laissé par un build de
      // production sur la même origine, et ses caches.
      void navigator.serviceWorker.getRegistrations().then((liste) => liste.forEach((r) => r.unregister()));
      if (typeof caches !== "undefined") {
        void caches.keys().then((noms) =>
          noms.filter((n) => n.startsWith(PREFIXE_CACHES)).forEach((n) => caches.delete(n))
        );
      }
      return;
    }

    const avaitUnControleur = !!navigator.serviceWorker.controller;
    let recharge = false;
    const surChangementControleur = () => {
      // Le nouveau worker a pris la main après « Recharger »
      if (!avaitUnControleur || recharge) return;
      recharge = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", surChangementControleur);

    const surMessage = (event: MessageEvent) => {
      if (event.data?.type === "RESEAU") setCacheServi(!!event.data.horsLigne);
    };
    navigator.serviceWorker.addEventListener("message", surMessage);

    const enregistrer = () =>
      navigator.serviceWorker
        .register(`/sw.js?v=${encodeURIComponent(VERSION)}`, { scope: "/", updateViaCache: "none" })
        .then((registration) => {
          if (registration.waiting && navigator.serviceWorker.controller) {
            void proposerRechargement(registration.waiting);
          }
          registration.addEventListener("updatefound", () => {
            const nouveau = registration.installing;
            nouveau?.addEventListener("statechange", () => {
              if (nouveau.state === "installed" && navigator.serviceWorker.controller) {
                void proposerRechargement(nouveau);
              }
            });
          });
          // La page a-t-elle été servie depuis le cache ?
          return messageServiceWorker<{ horsLigne: boolean }>({ type: "ETAT" }, { attendre: true });
        })
        .then((etat) => {
          if (etat?.horsLigne) setCacheServi(true);
        })
        .catch(() => {});

    // Après le chargement de la page, pour ne pas concurrencer le premier affichage
    if (document.readyState === "complete") void enregistrer();
    else window.addEventListener("load", enregistrer, { once: true });

    return () => {
      window.removeEventListener("load", enregistrer);
      navigator.serviceWorker.removeEventListener("controllerchange", surChangementControleur);
      navigator.serviceWorker.removeEventListener("message", surMessage);
    };
  }, []);

  // Retour du réseau : on cesse de considérer le cache comme seule source
  useEffect(() => {
    if (!navigateurEnLigne) return;
    const surRetour = () => setCacheServi(false);
    window.addEventListener("online", surRetour);
    return () => window.removeEventListener("online", surRetour);
  }, [navigateurEnLigne]);

  // Proposition d'installation
  useEffect(() => {
    const surProposition = (e: Event) => {
      e.preventDefault();
      setEvenementInstallation(e as EvenementInstallation);
    };
    const surInstallee = () => setEvenementInstallation(null);
    window.addEventListener("beforeinstallprompt", surProposition);
    window.addEventListener("appinstalled", surInstallee);
    return () => {
      window.removeEventListener("beforeinstallprompt", surProposition);
      window.removeEventListener("appinstalled", surInstallee);
    };
  }, []);

  const installer = useCallback(async () => {
    if (!evenementInstallation) return;
    await evenementInstallation.prompt();
    await evenementInstallation.userChoice;
    setEvenementInstallation(null);
  }, [evenementInstallation]);

  return (
    <Contexte.Provider
      value={{
        horsLigne: !navigateurEnLigne || cacheServi,
        installationDisponible: !!evenementInstallation,
        installer,
      }}
    >
      {children}
    </Contexte.Provider>
  );
}
