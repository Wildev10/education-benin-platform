// Notification d'une alerte aggravée (Moyen → Élevé) dans la cloche : chaîne
// complète, de la saisie des notes par l'enseignant à la cloche de l'admin.
//
// Écrit dans la base de DEV (la garde de commun.mjs refuse une base protégée) :
// un élève de test, ses notes, son alerte et les entrées d'audit de ces notes.
// Tout est supprimé à la fin, même en cas d'échec.
import path from "node:path";
import pg from "pg";
import { COMPTES, connecter, creerRapport, dossierResultats, getJson, lancerNavigateur, ouvrir } from "./commun.mjs";

const rapport = creerRapport("Notifications d'aggravation");
const { check } = rapport;
const CAPTURES = dossierResultats("captures", "notifications");
const NOM_TEST = "E2E-Aggravation";
const ANNEE = "2025-2026";

const base = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
await base.connect();

/** Supprime toutes les données de l'élève de test (et les restes d'un lancement interrompu). */
async function nettoyer() {
  const { rows } = await base.query(`SELECT id FROM "Etudiant" WHERE nom = $1`, [NOM_TEST]);
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return 0;
  await base.query(
    `DELETE FROM "ActionLog" WHERE "entityType" = 'note' AND "entityId" IN (SELECT id FROM "Note" WHERE "etudiantId" = ANY($1))`,
    [ids]
  );
  await base.query(`DELETE FROM "Note" WHERE "etudiantId" = ANY($1)`, [ids]);
  await base.query(`DELETE FROM "Alerte" WHERE "etudiantId" = ANY($1)`, [ids]);
  await base.query(`DELETE FROM "Etudiant" WHERE id = ANY($1)`, [ids]);
  return ids.length;
}

const restes = await nettoyer();
if (restes) console.log(`   ${restes} élève(s) de test d'un lancement précédent supprimé(s)`);

const navigateur = await lancerNavigateur();
const erreursJs = [];
const session = async (compte, options) => {
  const page = await connecter(navigateur, compte, options);
  page.on("pageerror", (e) => erreursJs.push(`${compte.email} : ${e.message}`));
  return page;
};

const lireAlerte = async (etudiantId) =>
  (await base.query(`SELECT "niveauRisque", "niveauModifieLe", statut FROM "Alerte" WHERE "etudiantId" = $1`, [etudiantId])).rows;

/** Saisit une note du trimestre 2 comme le ferait l'enseignant (POST /api/notes). */
const saisirNote = (page, etudiantId, valeur) =>
  page.evaluate(
    async (corps) => {
      const r = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
      return { status: r.status, corps: await r.json() };
    },
    { etudiantId, matiere: "Mathématiques", valeur, periode: "Trimestre 2", anneeScolaire: ANNEE }
  );

const cloche = (page) => page.locator('button[aria-haspopup="true"][aria-label^="Notifications"]');
const dropdown = (page) => page.getByRole("dialog", { name: "Dernières alertes" });

/** Recharge la page, attend la réponse de la cloche, puis lit son libellé (nombre de non lues). */
async function rafraichirCloche(page) {
  const reponse = page.waitForResponse((r) => r.url().includes("/api/notifications/alertes"), { timeout: 30000 });
  await page.reload();
  await reponse;
  await page.waitForTimeout(300);
  return cloche(page).getAttribute("aria-label");
}

/** Ouvre le dropdown (ce qui marque tout comme lu) et renvoie l'entrée de l'élève de test. */
async function ouvrirEtLire(page, prenom) {
  await cloche(page).click();
  await dropdown(page).waitFor();
  const entree = dropdown(page).locator("li", { hasText: prenom });
  const presente = (await entree.count()) > 0;
  return {
    presente,
    badge: presente ? (await entree.locator("[data-evenement]").textContent())?.replace(/\s+/g, " ").trim() : null,
    evenement: presente ? await entree.locator("[data-evenement]").getAttribute("data-evenement") : null,
    miseEnAvant: presente ? (await entree.locator("a").getAttribute("class"))?.includes("bg-brand-light") : false,
  };
}

const nonLues = (libelle) => Number(libelle?.match(/(\d+) nouvelle/)?.[1] ?? 0);

try {
  // ── Préparation : un élève de test avec une note au trimestre 1 (15/20) ─────
  const ens = await session(COMPTES.enseignant);
  const liste = await getJson(ens, "/api/etudiants?page=1");
  if (liste.status !== 200) throw new Error(`GET /api/etudiants?page=1 → ${liste.status} ${JSON.stringify(liste.corps)}`);
  const etab = liste.corps.elements[0].etablissement;
  const suffixe = Date.now().toString(36);
  const etudiantId = `e2e-aggr-${suffixe}`;
  const prenom = `Test${suffixe}`;
  await base.query(
    `INSERT INTO "Etudiant" (id, nom, prenom, "dateNaissance", sexe, "etablissementId", niveau) VALUES ($1, $2, $3, '2010-01-01', 'M', $4, 'Seconde C')`,
    [etudiantId, NOM_TEST, prenom, etab.id]
  );
  await base.query(
    `INSERT INTO "Note" (id, "etudiantId", matiere, valeur, periode, "anneeScolaire") VALUES ($1, $2, 'Mathématiques', 15, 'Trimestre 1', $3)`,
    [`e2e-note-${suffixe}`, etudiantId, ANNEE]
  );

  // L'admin ouvre la cloche une première fois : tout ce qui existe déjà est lu
  const admin = await session(COMPTES.admin);
  await ouvrir(admin, "/admin");
  await rafraichirCloche(admin);
  await cloche(admin).click();
  await admin.keyboard.press("Escape");

  // ── 1. Création : 15 → 12,6 (−16 %) → alerte Moyen ──────────────────────────
  const creation = await saisirNote(ens, etudiantId, 12.6);
  const [apresCreation] = await lireAlerte(etudiantId);
  check("Saisie T2 = 12,6 : alerte Moyen créée, sans date d'aggravation",
    creation.status === 201 && apresCreation?.niveauRisque === "moyen" && apresCreation.niveauModifieLe === null,
    `${creation.status}, ${apresCreation?.niveauRisque}`);
  const libelleCreation = await rafraichirCloche(admin);
  const vueCreation = await ouvrirEtLire(admin, prenom);
  check("Cloche admin : la création est signalée (« Moyen »), non lue", nonLues(libelleCreation) >= 1 && vueCreation.presente &&
    vueCreation.evenement === "creee" && vueCreation.badge === "⚠ Moyen" && vueCreation.miseEnAvant, `${libelleCreation} — ${vueCreation.badge}`);
  await admin.keyboard.press("Escape"); // création lue

  // ── 2. Aggravation : moyenne T2 (12,6 + 5) / 2 = 8,8 (−41 %, < 10) → Élevé ──
  const aggravation = await saisirNote(ens, etudiantId, 5);
  const [apresAggravation] = await lireAlerte(etudiantId);
  check("Saisie T2 = 5 : la même alerte passe à Élevé, niveauModifieLe rempli",
    aggravation.corps.alerteMiseAJour === true && apresAggravation.niveauRisque === "eleve" && apresAggravation.niveauModifieLe instanceof Date &&
    (await lireAlerte(etudiantId)).length === 1, `${apresAggravation.niveauRisque}, ${apresAggravation.niveauModifieLe?.toISOString?.()}`);
  const libelleAggravation = await rafraichirCloche(admin);
  const vueAggravation = await ouvrirEtLire(admin, prenom);
  check("Cloche admin : l'aggravation redevient non lue, bien que la création ait été lue", nonLues(libelleAggravation) >= 1 && vueAggravation.miseEnAvant,
    libelleAggravation ?? "");
  check("Dropdown : « Aggravée : Moyen → Élevé », une seule entrée pour l'élève",
    vueAggravation.evenement === "aggravee" && vueAggravation.badge === "⚠ Aggravée : Moyen → Élevé" &&
    (await dropdown(admin).locator("li", { hasText: prenom }).count()) === 1, vueAggravation.badge ?? "");
  await dropdown(admin).screenshot({ path: path.join(CAPTURES, "aggravation-1280.png") });
  await admin.keyboard.press("Escape"); // aggravation lue

  // ── 3. Baisse : moyenne T2 (12,6 + 5 + 20) / 3 = 12,5 (−16 %) → Moyen ───────
  const baisse = await saisirNote(ens, etudiantId, 20);
  const [apresBaisse] = await lireAlerte(etudiantId);
  check("Saisie T2 = 20 (niveau calculé en baisse) : alerte inchangée (Élevé, même date)",
    baisse.status === 201 && baisse.corps.alerteCreee === false && apresBaisse.niveauRisque === "eleve" &&
    apresBaisse.niveauModifieLe.getTime() === apresAggravation.niveauModifieLe.getTime());
  const libelleBaisse = await rafraichirCloche(admin);
  check("Cloche admin : aucune nouvelle notification après une baisse", nonLues(libelleBaisse) === 0, libelleBaisse ?? "");

  // ── 4. Périmètre ─────────────────────────────────────────────────────────────
  const apiAdmin = (await getJson(admin, "/api/notifications/alertes")).corps;
  const pourAdmin = apiAdmin.find((n) => n.etudiant.id === etudiantId);
  check("API admin : l'aggravation est renvoyée (evenement « aggravee », niveau précédent « moyen »)",
    pourAdmin?.evenement === "aggravee" && pourAdmin.niveauPrecedent === "moyen" && pourAdmin.niveauRisque === "eleve");
  check("API enseignant : la cloche lui est interdite (403)", (await getJson(ens, "/api/notifications/alertes")).status === 403);
  if (COMPTES.directeur) {
    const dir = await session(COMPTES.directeur);
    const etabDir = (await getJson(dir, "/api/etudiants?page=1")).corps.elements[0]?.etablissement?.id;
    const pourDir = (await getJson(dir, "/api/notifications/alertes")).corps.some((n) => n.etudiant.id === etudiantId);
    check(etabDir === etab.id ? "API directeur du même établissement : l'aggravation est renvoyée" : "API directeur d'un autre établissement : l'aggravation n'est pas renvoyée",
      etabDir === etab.id ? pourDir : !pourDir);
    await dir.context().close();
  } else {
    rapport.ignorer("Périmètre directeur", "E2E_DIRECTEUR_EMAIL et E2E_DIRECTEUR_MOT_DE_PASSE non définis");
  }

  // ── 5. Affichage à 375 px ────────────────────────────────────────────────────
  const mobile = await session(COMPTES.admin, { largeur: 375, hauteur: 812 });
  await ouvrir(mobile, "/admin");
  await rafraichirCloche(mobile);
  const vueMobile = await ouvrirEtLire(mobile, prenom);
  const boite = await dropdown(mobile).boundingBox();
  check("375 px : « Aggravée : Moyen → Élevé » visible, dropdown dans l'écran, pas de défilement horizontal",
    vueMobile.badge === "⚠ Aggravée : Moyen → Élevé" && boite.x >= 0 && boite.x + boite.width <= 375 &&
    (await mobile.evaluate(() => document.documentElement.scrollWidth)) <= 375, `${Math.round(boite.x)}–${Math.round(boite.x + boite.width)} px`);
  await mobile.screenshot({ path: path.join(CAPTURES, "aggravation-375.png") });
  await mobile.context().close();

  await admin.context().close();
  await ens.context().close();
} finally {
  const supprimes = await nettoyer();
  const reste = (await base.query(`SELECT count(*)::int AS n FROM "Etudiant" WHERE nom = $1`, [NOM_TEST])).rows[0].n;
  check("Nettoyage : plus aucune donnée de test dans la base de dev (élève, notes, alerte, audit)", reste === 0, `${supprimes} élève(s) supprimé(s)`);
  await base.end();
  await navigateur.close();
}

check("Aucune erreur JS", erreursJs.length === 0, erreursJs.slice(0, 3).join(" ; "));
rapport.terminer();
