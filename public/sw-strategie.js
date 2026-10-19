/*
 * Choix de la stratégie de cache par requête, partagé entre le service worker
 * (via importScripts) et les tests. Script classique, sans dépendance.
 *
 * Stratégies :
 *   "reseau"     : le service worker ne touche pas à la requête (jamais en cache)
 *   "statique"   : cache d'abord (JS, CSS, polices, images, icônes, manifest)
 *   "page"       : réseau d'abord, repli sur la dernière version en cache
 *   "api"        : réseau d'abord, repli sur le cache (GET de lecture uniquement)
 */
(function (racine) {
  "use strict";

  // GET de lecture dont la réponse peut être relue hors ligne
  var API_LECTURE = [
    /^\/api\/etudiants$/,
    /^\/api\/etudiants\/[^/]+$/,
    /^\/api\/notes$/,
    /^\/api\/absences$/,
    /^\/api\/alertes$/,
    /^\/api\/inscriptions$/,
    /^\/api\/etablissements$/,
    /^\/api\/admin\/stats\/etablissements$/,
  ];

  // Jamais en cache, quelle que soit la méthode : authentification, exports PDF et Excel,
  // le service worker lui-même
  var JAMAIS = [
    /^\/api\/auth(\/|$)/,
    /^\/login(\/|$)/,
    /\/pdf$/,
    /\/xlsx$/,
    /^\/sw\.js$/,
    /^\/sw-strategie\.js$/,
  ];

  var EXTENSIONS_STATIQUES = /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/i;

  function correspond(motifs, chemin) {
    for (var i = 0; i < motifs.length; i++) {
      if (motifs[i].test(chemin)) return true;
    }
    return false;
  }

  /**
   * @param {{ url: string, method: string, mode?: string, origine: string,
   *           entete?: (nom: string) => string | null }} requete
   * @returns {"reseau" | "statique" | "page" | "api"}
   */
  function choisirStrategie(requete) {
    var entete = requete.entete || function () { return null; };
    var url;
    try {
      url = new URL(requete.url);
    } catch {
      return "reseau";
    }

    // Écritures : jamais interceptées ni mises en cache
    if ((requete.method || "GET").toUpperCase() !== "GET") return "reseau";
    // Autres origines (Sentry, polices externes…) : pas notre affaire
    if (url.origin !== requete.origine) return "reseau";
    if (correspond(JAMAIS, url.pathname)) return "reseau";
    // Requêtes partielles (médias)
    if (entete("range")) return "reseau";

    // Charges utiles RSC de la navigation côté client : leur contenu dépend de
    // l'état du routeur, on ne les met pas en cache. Hors ligne, leur échec
    // fait retomber Next.js sur une navigation complète, servie par "page".
    if (
      url.searchParams.has("_rsc") ||
      entete("rsc") === "1" ||
      entete("next-router-prefetch") ||
      entete("next-router-state-tree")
    ) {
      return "reseau";
    }

    if (
      url.pathname.indexOf("/_next/static/") === 0 ||
      url.pathname.indexOf("/_next/image") === 0 ||
      url.pathname.indexOf("/icons/") === 0 ||
      url.pathname === "/manifest.webmanifest" ||
      url.pathname === "/hors-ligne.html" ||
      EXTENSIONS_STATIQUES.test(url.pathname)
    ) {
      return "statique";
    }

    if (url.pathname.indexOf("/api/") === 0) {
      return correspond(API_LECTURE, url.pathname) ? "api" : "reseau";
    }

    var accept = entete("accept") || "";
    if (requete.mode === "navigate" || accept.indexOf("text/html") !== -1) return "page";

    return "reseau";
  }

  racine.EdutechStrategie = { choisirStrategie: choisirStrategie };
})(typeof self !== "undefined" ? self : globalThis);
