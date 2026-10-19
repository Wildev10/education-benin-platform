/*
 * Service worker EduTech Bénin — écrit à la main, sans dépendance.
 *
 * - Fichiers statiques : cache d'abord (cache versionné, purgé à chaque version).
 * - Pages et GET d'API de lecture : réseau d'abord, repli sur le cache.
 * - Écritures, authentification et exports PDF : jamais interceptés.
 *
 * Cloisonnement : les données (pages, API) sont rangées dans un cache propre à
 * l'utilisateur connecté (« edutech-donnees-<empreinte> »). Sans utilisateur
 * connu, rien n'est mis en cache ni servi depuis le cache. Changement de compte
 * ou déconnexion : tous les caches de données sont supprimés.
 */
"use strict";

var VERSION = new URL(self.location.href).searchParams.get("v") || "0";
importScripts("/sw-strategie.js?v=" + encodeURIComponent(VERSION));

var CACHE_STATIQUE = "edutech-statique-" + VERSION;
var PREFIXE_DONNEES = "edutech-donnees-";
var CACHE_META = "edutech-meta";
var CLE_UTILISATEUR = "/__pwa/utilisateur";
var CLE_ACCUEIL = "/__pwa/accueil";
var PAGE_HORS_LIGNE = "/hors-ligne.html";
var PRECACHE = [PAGE_HORS_LIGNE, "/icons/icon-192.png", "/manifest.webmanifest"];

var utilisateur = null; // empreinte de l'utilisateur connecté, ou null
var utilisateurCharge = false;
var horsLigne = false;
// Dernière mémorisation de chaque page (évite de recharger une page à chaque visite)
var derniereMemorisation = {};
var DELAI_MEMORISATION_MS = 60 * 1000;

// ── Utilisateur courant (persisté pour survivre à l'arrêt du worker) ─────────

function chargerUtilisateur() {
  if (utilisateurCharge) return Promise.resolve(utilisateur);
  return caches
    .open(CACHE_META)
    .then(function (c) { return c.match(CLE_UTILISATEUR); })
    .then(function (r) { return r ? r.text() : null; })
    .then(function (id) {
      utilisateur = id || null;
      utilisateurCharge = true;
      return utilisateur;
    });
}

function enregistrerUtilisateur(id) {
  utilisateur = id;
  utilisateurCharge = true;
  return caches.open(CACHE_META).then(function (c) {
    return id ? c.put(CLE_UTILISATEUR, new Response(id)) : c.delete(CLE_UTILISATEUR);
  });
}

function supprimerCaches(filtre) {
  return caches.keys().then(function (noms) {
    return Promise.all(noms.filter(filtre).map(function (n) { return caches.delete(n); }));
  });
}

function viderDonnees() {
  return supprimerCaches(function (n) { return n.indexOf(PREFIXE_DONNEES) === 0; });
}

function precacher() {
  return caches.open(CACHE_STATIQUE).then(function (c) { return c.addAll(PRECACHE); });
}

// ── État du réseau, signalé aux pages ouvertes ───────────────────────────────

function signalerReseau(estHorsLigne) {
  if (horsLigne === estHorsLigne) return;
  horsLigne = estHorsLigne;
  self.clients.matchAll({ includeUncontrolled: true }).then(function (liste) {
    liste.forEach(function (c) { c.postMessage({ type: "RESEAU", horsLigne: estHorsLigne }); });
  });
}

// ── Cycle de vie ─────────────────────────────────────────────────────────────

self.addEventListener("install", function (event) {
  // Pas de skipWaiting ici : une nouvelle version attend que l'utilisateur
  // accepte de recharger (toast côté page).
  event.waitUntil(precacher());
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    supprimerCaches(function (n) {
      return n.indexOf("edutech-statique-") === 0 && n !== CACHE_STATIQUE;
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("message", function (event) {
  var data = event.data || {};
  var repondre = function (valeur) {
    if (event.ports && event.ports[0]) event.ports[0].postMessage(valeur);
  };

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type === "UTILISATEUR") {
    var id = typeof data.id === "string" && data.id ? data.id : null;
    event.waitUntil(
      chargerUtilisateur()
        .then(function (actuel) {
          // Autre compte : rien de l'ancien ne doit rester
          if (actuel !== id) {
            derniereMemorisation = {};
            return viderDonnees().then(function () { return enregistrerUtilisateur(id); });
          }
        })
        .then(function () {
          if (!id) return;
          var suite = [];
          // Page d'accueil de l'espace : cible de « / » au lancement hors ligne
          if (typeof data.accueil === "string" && data.accueil.charAt(0) === "/") {
            suite.push(memoriser(CLE_ACCUEIL, new Response(data.accueil), id));
            suite.push(memoriserPage(new URL(data.accueil, self.location.origin).href));
          }
          if (typeof data.url === "string") suite.push(memoriserPage(data.url));
          return Promise.all(suite);
        })
        .then(function () { repondre({ ok: true }); }, function () { repondre({ ok: false }); })
    );
    return;
  }

  if (data.type === "DECONNEXION") {
    // Déconnexion : on vide tout, puis on remet la page hors ligne
    event.waitUntil(
      supprimerCaches(function (n) { return n.indexOf("edutech-") === 0; })
        .then(function () {
          utilisateur = null;
          utilisateurCharge = true;
          return precacher();
        })
        .then(function () { repondre({ ok: true }); }, function () { repondre({ ok: false }); })
    );
    return;
  }

  if (data.type === "MEMORISER_PAGE" && typeof data.url === "string") {
    event.waitUntil(memoriserPage(data.url));
    return;
  }

  if (data.type === "ETAT") {
    repondre({ horsLigne: horsLigne, version: VERSION });
  }
});

// ── Stratégies ───────────────────────────────────────────────────────────────

function reponseMemorisable(reponse) {
  if (!reponse || !reponse.ok || reponse.redirected || reponse.type !== "basic") return false;
  var type = reponse.headers.get("content-type") || "";
  return type.indexOf("application/pdf") === -1;
}

function cacheDonnees() {
  return chargerUtilisateur().then(function (id) {
    return id ? caches.open(PREFIXE_DONNEES + id) : null;
  });
}

// Écrit dans le cache du compte pour lequel la requête est partie, et
// seulement s'il est toujours connecté : une réponse arrivée après un
// changement de compte appartient à l'ancien compte et est jetée.
function memoriser(cle, reponse, idAuDepart) {
  if (!idAuDepart || utilisateur !== idAuDepart) return Promise.resolve();
  return caches.open(PREFIXE_DONNEES + idAuDepart).then(function (cache) {
    if (utilisateur !== idAuDepart) return;
    return cache.put(cle, reponse);
  });
}

function statique(requete) {
  return caches.open(CACHE_STATIQUE).then(function (cache) {
    return cache.match(requete).then(function (enCache) {
      if (enCache) return enCache;
      return fetch(requete).then(function (reponse) {
        if (reponse.ok && reponse.type === "basic") cache.put(requete, reponse.clone());
        return reponse;
      });
    });
  });
}

function reponseHorsLigneApi() {
  return new Response(JSON.stringify({ error: "Vous êtes hors ligne." }), {
    status: 503,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function pageHorsLigne() {
  return caches.match(PAGE_HORS_LIGNE).then(function (r) {
    return r || new Response("Vous êtes hors ligne.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  });
}

function reseauDabord(requete, estPage) {
  var idAuDepart = chargerUtilisateur();
  return fetch(requete).then(
    function (reponse) {
      signalerReseau(false);
      var chemin = new URL(requete.url).pathname;
      // « / » redirige selon le rôle : on retient la destination pour le
      // lancement de l'application installée hors ligne
      if (estPage && chemin === "/" && reponse.redirected) {
        var destination = new URL(reponse.url).pathname;
        if (destination !== "/login") {
          idAuDepart.then(function (id) { return memoriser(CLE_ACCUEIL, new Response(destination), id); });
        }
      }
      if (reponseMemorisable(reponse)) {
        if (estPage) derniereMemorisation[requete.url] = Date.now();
        var copie = reponse.clone();
        idAuDepart.then(function (id) { return memoriser(requete, copie, id); });
      }
      return reponse;
    },
    function () {
      signalerReseau(true);
      return cacheDonnees().then(function (cache) {
        if (!cache) return estPage ? pageHorsLigne() : reponseHorsLigneApi();
        return cache.match(requete, { ignoreVary: true }).then(function (enCache) {
          if (enCache) return enCache;
          if (!estPage) return reponseHorsLigneApi();
          if (new URL(requete.url).pathname === "/") {
            return cache.match(CLE_ACCUEIL).then(function (r) {
              return r
                ? r.text().then(function (dest) {
                    return Response.redirect(new URL(dest, self.location.origin).href, 302);
                  })
                : pageHorsLigne();
            });
          }
          return pageHorsLigne();
        });
      });
    }
  );
}

// Les navigations côté client passent par des requêtes RSC non mises en cache :
// la page signale chaque URL visitée et on en mémorise le HTML en arrière-plan.
function memoriserPage(url) {
  var cible = new URL(url, self.location.origin);
  if (cible.origin !== self.location.origin) return Promise.resolve();
  var strategie = self.EdutechStrategie.choisirStrategie({
    url: cible.href,
    method: "GET",
    mode: "navigate",
    origine: self.location.origin,
  });
  if (strategie !== "page") return Promise.resolve();
  var derniere = derniereMemorisation[cible.href];
  if (derniere && Date.now() - derniere < DELAI_MEMORISATION_MS) return Promise.resolve();
  derniereMemorisation[cible.href] = Date.now();
  return chargerUtilisateur().then(function (id) {
    if (!id) return;
    var requete = new Request(cible.href, { credentials: "same-origin", headers: { Accept: "text/html" } });
    return fetch(requete).then(
      function (reponse) {
        if (reponseMemorisable(reponse)) return memoriser(new Request(cible.href), reponse, id);
      },
      function () { /* hors ligne : on garde la version précédente */ }
    );
  });
}

self.addEventListener("fetch", function (event) {
  var requete = event.request;
  var strategie = self.EdutechStrategie.choisirStrategie({
    url: requete.url,
    method: requete.method,
    mode: requete.mode,
    origine: self.location.origin,
    entete: function (nom) { return requete.headers.get(nom); },
  });

  if (strategie === "statique") event.respondWith(statique(requete));
  else if (strategie === "page") event.respondWith(reseauDabord(requete, true));
  else if (strategie === "api") event.respondWith(reseauDabord(requete, false));
  // "reseau" : pas de respondWith, le navigateur traite la requête normalement
});
