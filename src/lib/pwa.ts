// Utilitaires PWA côté navigateur (aucun import serveur).

/** Préfixe de tous les caches de l'application (statiques, données, méta). */
export const PREFIXE_CACHES = "edutech-";

/**
 * Empreinte stable d'un identifiant utilisateur, utilisée pour nommer son cache
 * de données sans exposer l'e-mail en clair (cyrb53, non cryptographique : sert
 * à distinguer les comptes, pas à protéger un secret).
 */
export function empreinteUtilisateur(identifiant: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < identifiant.length; i++) {
    const c = identifiant.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Envoie un message au service worker actif, et attend sa réponse si demandé. */
export async function messageServiceWorker<T = unknown>(
  message: Record<string, unknown>,
  { attendre = false, delaiMs = 3000 }: { attendre?: boolean; delaiMs?: number } = {}
): Promise<T | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  // À la première visite, le worker peut ne pas être encore actif : on l'attend
  // un peu (ready ne se résout jamais s'il n'y a pas de service worker)
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), delaiMs)),
  ]);
  const worker = navigator.serviceWorker.controller ?? registration?.active ?? null;
  if (!worker) return null;
  if (!attendre) {
    worker.postMessage(message);
    return null;
  }
  return new Promise<T | null>((resolve) => {
    const canal = new MessageChannel();
    const minuteur = setTimeout(() => resolve(null), delaiMs);
    canal.port1.onmessage = (event) => {
      clearTimeout(minuteur);
      resolve(event.data as T);
    };
    worker.postMessage(message, [canal.port2]);
  });
}

/**
 * Vide entièrement les caches de l'application (déconnexion, nouvelle
 * connexion) : rien d'un compte ne doit pouvoir être relu par le suivant.
 * Supprime directement depuis la page (même stockage que le service worker),
 * puis prévient le service worker pour qu'il oublie l'utilisateur courant.
 */
export async function viderCachesPwa(): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      const noms = await caches.keys();
      await Promise.all(noms.filter((n) => n.startsWith(PREFIXE_CACHES)).map((n) => caches.delete(n)));
    }
    await messageServiceWorker({ type: "DECONNEXION" }, { attendre: true });
  } catch {
    // Stockage indisponible (navigation privée stricte…) : rien à vider
  }
}
