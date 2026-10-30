// Alertes de décrochage, de la saisie de l'enseignant à la cloche : message après
// chaque saisie, liste des alertes de la fiche, cloche de l'enseignant et de
// l'admin (30 jours, lu / non lu enregistré côté serveur et partagé entre
// appareils), réouverture d'une alerte résolue qui s'aggrave, import CSV.
//
// Écrit dans la base de DEV (la garde de commun.mjs refuse une base protégée) :
// deux élèves de test, leurs notes, absences, alertes, un compte élève pour
// l'import et les entrées d'audit correspondantes. Tout est supprimé à la fin,
// même en cas d'échec, et les dates de consultation de la cloche des comptes
// de démonstration sont remises à leur valeur d'origine.
import path from "node:path";
import { writeFileSync } from "node:fs";
import pg from "pg";
import { AUJOURDHUI, COMPTES, connecter, creerRapport, dossierResultats, getJson, lancerNavigateur, ouvrir } from "./commun.mjs";

const rapport = creerRapport("Notifications d'alertes");
const { check } = rapport;
const CAPTURES = dossierResultats("captures", "notifications");
const NOM_TEST = "E2E-Alertes";

// Période en cours au Bénin, même règle que src/lib/annee-scolaire.ts
const [an, mois] = AUJOURDHUI.split("-").map(Number);
const debut = mois >= 9 ? an : an - 1;
const ANNEE = `${debut}-${debut + 1}`;
const PERIODE = mois >= 9 ? "Trimestre 1" : mois <= 3 ? "Trimestre 2" : "Trimestre 3";
// Période précédente : la base de comparaison des élèves de test
const PRECEDENTE = PERIODE === "Trimestre 1"
  ? { periode: "Trimestre 3", annee: `${debut - 1}-${debut}` }
  : { periode: PERIODE === "Trimestre 2" ? "Trimestre 1" : "Trimestre 2", annee: ANNEE };

const base = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
await base.connect();
const debutTest = new Date();

/** Supprime toutes les données des élèves de test (et les restes d'un lancement interrompu). */
async function nettoyer() {
  const { rows } = await base.query(`SELECT id FROM "Etudiant" WHERE nom = $1`, [NOM_TEST]);
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return 0;
  await base.query(
    `DELETE FROM "ActionLog" WHERE "entityId" IN (
       SELECT id FROM "Note" WHERE "etudiantId" = ANY($1)
       UNION SELECT id FROM "Absence" WHERE "etudiantId" = ANY($1)
       UNION SELECT id FROM "Alerte" WHERE "etudiantId" = ANY($1))`,
    [ids]
  );
  // Import CSV : une entrée d'audit sans identifiant, par le compte enseignant, pendant ce test
  await base.query(
    `DELETE FROM "ActionLog" WHERE action = 'NOTES_IMPORTEES' AND "createdAt" >= $1
       AND "userId" = (SELECT id FROM "User" WHERE email = $2) AND description = '2 notes importées depuis un fichier CSV'`,
    [debutTest, COMPTES.enseignant.email]
  );
  await base.query(`DELETE FROM "User" WHERE "etudiantId" = ANY($1)`, [ids]);
  await base.query(`DELETE FROM "Note" WHERE "etudiantId" = ANY($1)`, [ids]);
  await base.query(`DELETE FROM "Absence" WHERE "etudiantId" = ANY($1)`, [ids]);
  await base.query(`DELETE FROM "Alerte" WHERE "etudiantId" = ANY($1)`, [ids]);
  await base.query(`DELETE FROM "Etudiant" WHERE id = ANY($1)`, [ids]);
  return ids.length;
}

const restes = await nettoyer();
if (restes) console.log(`   ${restes} élève(s) de test d'un lancement précédent supprimé(s)`);

// Dates de consultation d'origine des comptes de démonstration, rétablies à la fin
const emails = [COMPTES.admin.email, COMPTES.enseignant.email, COMPTES.directeur?.email].filter(Boolean);
const vuesOrigine = (await base.query(`SELECT id, "notificationsVuesLe" FROM "User" WHERE email = ANY($1)`, [emails])).rows;

const navigateur = await lancerNavigateur();
const erreursJs = [];
const session = async (compte, options) => {
  const page = await connecter(navigateur, compte, options);
  page.on("pageerror", (e) => erreursJs.push(`${compte.email} : ${e.message}`));
  return page;
};

const lireAlertes = async (etudiantId) =>
  (await base.query(`SELECT id, type, "niveauRisque", "niveauModifieLe", statut, "suiviDepuis", "motifCloture", "createdAt" FROM "Alerte" WHERE "etudiantId" = $1`, [etudiantId])).rows;

const cloche = (page) => page.locator('button[aria-haspopup="true"][aria-label^="Notifications"]');
const dropdown = (page) => page.getByRole("dialog", { name: "Dernières alertes" });
const nonLues = (libelle) => Number(libelle?.match(/(\d+) nouvelle/)?.[1] ?? 0);
const texte = async (locator) => ((await locator.count()) ? (await locator.first().innerText()).replace(/\s+/g, " ").trim() : "");

/** Recharge la page, attend la réponse de la cloche, puis lit son libellé (nombre de non lues). */
async function rafraichirCloche(page) {
  const reponse = page.waitForResponse((r) => r.url().includes("/api/notifications/alertes") && r.request().method() === "GET", { timeout: 30000 });
  await page.reload();
  await reponse;
  await page.waitForTimeout(300);
  return cloche(page).getAttribute("aria-label");
}

/** Ouvre la cloche (ce qui enregistre la consultation) et lit l'entrée de l'élève. */
async function ouvrirEtLire(page, prenom) {
  const enregistrement = page.waitForResponse((r) => r.url().includes("/api/notifications/alertes") && r.request().method() === "POST", { timeout: 10000 }).catch(() => null);
  await cloche(page).click();
  await dropdown(page).waitFor();
  const entree = dropdown(page).locator("li", { hasText: prenom });
  const presente = (await entree.count()) > 0;
  const lu = {
    presente,
    nombre: await entree.count(),
    badge: presente ? (await entree.locator("[data-evenement]").textContent())?.replace(/\s+/g, " ").trim() : null,
    evenement: presente ? await entree.locator("[data-evenement]").getAttribute("data-evenement") : null,
    miseEnAvant: presente ? (await entree.locator("a").getAttribute("class"))?.includes("bg-brand-light") : false,
  };
  await enregistrement;
  return lu;
}

/** Saisit une note avec le formulaire de la fiche et renvoie le message affiché. */
async function saisirNote(page, valeur) {
  await page.fill("#valeur", String(valeur));
  const reponse = page.waitForResponse((r) => r.url().endsWith("/api/notes") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Enregistrer la note" }).click();
  await reponse;
  await page.locator("#new-note-title ~ div [data-retour]").waitFor();
  return texte(page.locator("#new-note-title ~ div [data-retour]"));
}

try {
  // ── Préparation : élève de test, une période précédente à 15/20 ─────────────
  const ens = await session(COMPTES.enseignant);
  const liste = await getJson(ens, "/api/etudiants?page=1");
  if (liste.status !== 200) throw new Error(`GET /api/etudiants?page=1 → ${liste.status} ${JSON.stringify(liste.corps)}`);
  const etab = liste.corps.elements[0].etablissement;
  const suffixe = Date.now().toString(36);
  const creerEleve = async (id, prenom) => {
    await base.query(
      `INSERT INTO "Etudiant" (id, nom, prenom, "dateNaissance", sexe, "etablissementId", niveau) VALUES ($1, $2, $3, '2010-01-01', 'M', $4, 'Seconde C')`,
      [id, NOM_TEST, prenom, etab.id]
    );
  };
  const etudiantId = `e2e-alertes-${suffixe}`;
  const prenom = `Test${suffixe}`;
  const nomComplet = `${prenom} ${NOM_TEST}`;
  await creerEleve(etudiantId, prenom);
  await base.query(
    `INSERT INTO "Note" (id, "etudiantId", matiere, valeur, periode, "anneeScolaire") VALUES ($1, $2, 'Mathématiques', 15, $3, $4)`,
    [`e2e-note-${suffixe}`, etudiantId, PRECEDENTE.periode, PRECEDENTE.annee]
  );

  // ── 1. Fiche : période du jour proposée, aucune comparaison possible ─────────
  await ouvrir(ens, `/enseignant/etudiants/${etudiantId}`);
  const periodeProposee = await ens.locator("#periode").inputValue();
  const anneeAffichee = await texte(ens.locator("#new-note-title + p strong"));
  check(`Fiche : période proposée = ${PERIODE} ${ANNEE} (celle du jour au Bénin), plus « 2025-2026 » figée`,
    periodeProposee === PERIODE && anneeAffichee === ANNEE && (await ens.locator("#abs-periode").inputValue()) === PERIODE,
    `${periodeProposee} ${anneeAffichee}`);
  const mentionInitiale = await texte(ens.locator('[data-comparaison="sans_periode_precedente"]'));
  check("Fiche, élève sans période précédente : « Pas encore de période de comparaison »",
    mentionInitiale.startsWith("Pas encore de période de comparaison"), mentionInitiale);

  // L'enseignant et l'admin ont tout lu avant le test : seules les alertes du test seront nouvelles
  const admin = await session(COMPTES.admin);
  await base.query(`UPDATE "User" SET "notificationsVuesLe" = now() WHERE email = ANY($1)`, [[COMPTES.enseignant.email, COMPTES.admin.email]]);

  // ── 2. Première note de la période : enregistrée, pas encore comparée ─────────
  const message1 = await saisirNote(ens, 12);
  check("Note 12/20 : « Note enregistrée », sans alerte", message1.startsWith("Note enregistrée") && message1.includes("Aucune alerte")
    && (await lireAlertes(etudiantId)).length === 0, message1);
  const mention1 = await texte(ens.locator('[data-comparaison="notes_insuffisantes"]'));
  check("Fiche : « Notes comparées à partir de 2 notes » (1 pour l'instant)", mention1.includes("à partir de 2 notes") && mention1.includes("1 pour l'instant"), mention1);

  // ── 3. Deuxième note : moyenne 12,25 contre 15 (−18 %) → alerte Moyen ─────────
  const message2 = await saisirNote(ens, 12.5);
  check(`Note 12,5/20 : « Alerte déclenchée : niveau Moyen pour ${nomComplet} »`, message2.startsWith(`Alerte déclenchée : niveau Moyen pour ${nomComplet}`), message2);
  const alertesFiche = ens.locator('section[aria-labelledby="alertes-eleve-titre"] article');
  check("Fiche : l'alerte apparaît dans l'historique sans recharger, la mention de comparaison disparaît",
    (await alertesFiche.count()) === 1 && (await texte(alertesFiche)).includes("Risque moyen") && (await ens.locator("[data-comparaison]").count()) === 0);
  await ens.locator('section[aria-labelledby="new-note-title"]').screenshot({ path: path.join(CAPTURES, "alerte-declenchee-1280.png") });

  // ── 4. Cloche de l'enseignant ────────────────────────────────────────────────
  const libelleEns = await rafraichirCloche(ens);
  const vueEns = await ouvrirEtLire(ens, prenom);
  check("Cloche enseignant : l'alerte de son élève est signalée, non lue", nonLues(libelleEns) >= 1 && vueEns.presente && vueEns.badge === "Moyen" && vueEns.miseEnAvant,
    `${libelleEns} — ${vueEns.badge}`);
  await ens.keyboard.press("Escape");
  const notifsEns = (await getJson(ens, "/api/notifications/alertes")).corps.notifications;
  check("API enseignant : uniquement les alertes de son établissement", notifsEns.length > 0 && notifsEns.every((n) => n.etablissement.id === etab.id));

  // ── 5. Admin, 2 heures plus tard (plus de fenêtre de 5 minutes) ──────────────
  const [{ id: idAlerte }] = await lireAlertes(etudiantId);
  await base.query(`UPDATE "Alerte" SET "createdAt" = now() - interval '2 hours' WHERE id = $1`, [idAlerte]);
  const [alerteMoyen] = await lireAlertes(etudiantId);
  await base.query(`UPDATE "User" SET "notificationsVuesLe" = now() - interval '1 day' WHERE email = $1`, [COMPTES.admin.email]);
  await ouvrir(admin, "/admin");
  const libelleAdmin = await rafraichirCloche(admin);
  const vueAdmin = await ouvrirEtLire(admin, prenom);
  check("Cloche admin, connecté 2 h après la saisie : l'alerte est signalée, non lue",
    nonLues(libelleAdmin) >= 1 && vueAdmin.presente && vueAdmin.evenement === "creee" && vueAdmin.miseEnAvant, `${libelleAdmin} — ${vueAdmin.badge}`);
  await admin.keyboard.press("Escape");
  const vuesLeAdmin = (await base.query(`SELECT "notificationsVuesLe" AS d FROM "User" WHERE email = $1`, [COMPTES.admin.email])).rows[0].d;
  // Date du dernier événement affiché (au moins celui de l'élève de test)
  check("Ouverture de la cloche : consultation enregistrée en base pour l'admin", vuesLeAdmin >= alerteMoyen.createdAt);

  // ── 6. Second appareil (375 px) : déjà lue ───────────────────────────────────
  const mobile = await session(COMPTES.admin, { largeur: 375, hauteur: 812 });
  await ouvrir(mobile, "/admin");
  await rafraichirCloche(mobile);
  const etatMobile = (await getJson(mobile, "/api/notifications/alertes")).corps;
  const entreeMobile = etatMobile.notifications.find((n) => n.etudiant.id === etudiantId);
  check("Autre appareil : la même alerte y est déjà lue (date de consultation partagée)",
    entreeMobile && etatMobile.vuesLe >= entreeMobile.date, `${etatMobile.vuesLe} / ${entreeMobile?.date}`);

  // ── 7. Suivi dans la fiche : action obligatoire, historique affiché ────────
  await ens.getByRole("button", { name: "Ajouter une action" }).click();
  const formulaire = ens.locator("[data-formulaire-suivi]");
  await formulaire.getByRole("button", { name: "Enregistrer l'action" }).click();
  check("Suivi : sans action choisie, l'enregistrement est refusé avec un message",
    /Choisissez l'action menée/.test(await texte(formulaire.locator('[role="alert"]'))));
  await formulaire.getByLabel("Entretien avec l'élève").check();
  await formulaire.getByLabel("Commentaire").fill("Entretien e2e : l'élève reconnaît un manque de travail.");
  const reponseSuivi = ens.waitForResponse((r) => r.url().endsWith(`/api/alertes/${alerteMoyen.id}/suivis`));
  await formulaire.getByRole("button", { name: "Enregistrer l'action" }).click();
  check("Suivi : action enregistrée (201)", (await reponseSuivi).status() === 201);
  await ens.locator("[data-historique-suivi]").waitFor();
  const carte = await texte(alertesFiche);
  check("Fiche : statut « En cours de suivi » et historique (action, auteur, commentaire) sans recharger",
    /En cours de suivi/.test(carte) && /Entretien avec l'élève/.test(carte) && /Fulbert Gbaguidi|Gbaguidi/.test(carte) && /manque de travail/.test(carte), carte.slice(0, 200));

  check("Fiche : responsable du suivi désigné par défaut, l'auteur de la première action",
    /Responsable du suivi : Fulbert Gbaguidi/.test(carte), carte.slice(0, 200));

  // ── 8. Suivi confié à la directrice : historique, cloche, « Mes suivis » ────
  const dir = COMPTES.directeur ? await session(COMPTES.directeur) : null;
  const memeEtab = dir && (await getJson(dir, "/api/etudiants?page=1")).corps.elements[0]?.etablissement?.id === etab.id;
  if (dir && memeEtab) {
    await ens.getByRole("button", { name: "Changer le responsable" }).click();
    const confier = ens.locator('[data-formulaire-suivi="confier"]');
    await confier.getByLabel("Confier le suivi à").selectOption({ label: "Bernadette Sossou (direction)" });
    const reponseConfie = ens.waitForResponse((r) => r.url().endsWith(`/api/alertes/${alerteMoyen.id}/suivis`));
    await confier.getByRole("button", { name: "Confier le suivi" }).click();
    check("Changer le responsable : suivi confié à la directrice (201), commentaire facultatif", (await reponseConfie).status() === 201);
    await ens.locator('[data-etape="confie"]').waitFor();
    const carteConfiee = await texte(alertesFiche);
    check("Fiche : « Responsable du suivi : Bernadette Sossou » et « Suivi confié à Bernadette Sossou » dans l'historique",
      /Responsable du suivi : Bernadette Sossou/.test(carteConfiee) && /Suivi confié à Bernadette Sossou/.test(carteConfiee), carteConfiee.slice(0, 300));
    const notifsDir = (await getJson(dir, "/api/notifications/alertes")).corps.notifications;
    const confiee = notifsDir.find((n) => n.id === alerteMoyen.id);
    check("Cloche de la directrice : « Suivi confié par Fulbert Gbaguidi », marquée comme son suivi",
      confiee?.evenement === "confiee" && confiee.confiePar === "Fulbert Gbaguidi" && confiee.votreSuivi === true, JSON.stringify(confiee ?? null));
    const notifEns = (await getJson(ens, "/api/notifications/alertes")).corps.notifications.find((n) => n.id === alerteMoyen.id);
    check("Cloche de l'enseignant : pas de « Suivi confié » (ce n'est plus son suivi)", notifEns?.evenement !== "confiee" && !notifEns?.votreSuivi);
    const mesSuivisDir = (await getJson(dir, "/api/alertes?page=1&statut=toutes&suivi=moi")).corps;
    const mesSuivisEns = (await getJson(ens, "/api/alertes?page=1&statut=toutes&suivi=moi")).corps;
    check("« Mes suivis » : l'alerte est dans ceux de la directrice, plus dans ceux de l'enseignant ; le total compte ce qui est affiché",
      mesSuivisDir.elements.some((a) => a.id === alerteMoyen.id) && !mesSuivisEns.elements.some((a) => a.id === alerteMoyen.id) &&
        mesSuivisDir.elements.every((a) => a.responsable?.id) && mesSuivisDir.total >= mesSuivisDir.elements.length);
  } else {
    rapport.ignorer("Suivi confié à la directrice", "compte directeur absent ou d'un autre établissement");
  }

  // ── 9. Résolution directe (motif en un clic), puis aggravation : rouverte ────
  await ens.getByRole("button", { name: "Résoudre l'alerte" }).click();
  const resoudre = ens.locator('[data-formulaire-suivi="resoudre"]');
  await resoudre.getByLabel("Autre", { exact: true }).check();
  await resoudre.getByRole("button", { name: "Résoudre l'alerte" }).click();
  check("Résolution, motif « Autre » sans commentaire : refusée avec un message",
    /« Autre », le commentaire est obligatoire/.test(await texte(resoudre.locator('[role="alert"]'))));
  await resoudre.getByLabel("Situation rétablie").check();
  const reponseResolution = ens.waitForResponse((r) => r.url().endsWith(`/api/alertes/${alerteMoyen.id}/suivis`));
  await resoudre.getByRole("button", { name: "Résoudre l'alerte" }).click();
  check("Résolution directe : motif « Situation rétablie », sans commentaire (201)", (await reponseResolution).status() === 201);
  await ens.locator('[data-etape="resolution"]').waitFor();
  check("Fiche : « Résolue », motif dans l'historique et sous l'alerte",
    /Résolution : Situation rétablie/.test(await texte(alertesFiche)) && /Motif de clôture : Situation rétablie/.test(await texte(alertesFiche)));
  check("Admin : le suivi lui est refusé (consultation seule, 403)",
    (await admin.evaluate(async (id) => (await fetch(`/api/alertes/${id}/suivis`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transition: "rouvrir", commentaire: "Tentative de l'admin, refusée." }),
    })).status, alerteMoyen.id)) === 403);
  const responsableAttendu = dir && memeEtab ? "Bernadette Sossou" : "Fulbert Gbaguidi";
  // Moyenne (12 + 12,5 + 3) / 3 = 9,17 contre 15 : −39 % et < 10 → Élevé
  const message3 = await saisirNote(ens, 3);
  const apres = await lireAlertes(etudiantId);
  check(`Note 3/20 : « Alerte rouverte et aggravée : Moyen → Élevé pour ${nomComplet} »`,
    message3.startsWith(`Alerte rouverte et aggravée : Moyen → Élevé pour ${nomComplet}`), message3);
  check("Base : la même alerte, rouverte En cours de suivi (elle avait un responsable), niveau Élevé, motif effacé",
    apres.length === 1 && apres[0].statut === "active" && apres[0].suiviDepuis instanceof Date && apres[0].motifCloture === null &&
      apres[0].niveauRisque === "eleve" && apres[0].niveauModifieLe instanceof Date,
    `${apres.length} alerte(s), ${apres[0]?.statut}, ${apres[0]?.niveauRisque}`);
  const etapes = (await base.query(`SELECT action, "statutAvant", "statutApres", "auteurId", "motifCloture" FROM "SuiviAlerte" WHERE "alerteId" = $1 ORDER BY "createdAt"`, [alerteMoyen.id])).rows;
  const finEtapes = etapes.slice(-2);
  check("Base : résolution avec son motif, puis réouverture automatique En cours de suivi par la détection",
    finEtapes[0]?.action === "resolution" && finEtapes[0].motifCloture === "situation_retablie" && finEtapes[0].statutApres === "resolue" &&
      finEtapes[1]?.action === "reouverture_auto" && finEtapes[1].statutApres === "en_suivi" && finEtapes[1].auteurId === null,
    etapes.map((e) => `${e.action}:${e.statutAvant}→${e.statutApres}`).join(", "));
  await ens.reload();
  await ens.waitForLoadState("networkidle");
  const carteRouverte = await texte(alertesFiche);
  check(`Fiche : l'alerte rouverte (Élevé, En cours de suivi, responsable ${responsableAttendu}), « suivi repris par » dans l'historique`,
    (await alertesFiche.count()) === 1 && /Risque élevé/.test(carteRouverte) && /En cours de suivi/.test(carteRouverte) &&
      carteRouverte.includes(`Responsable du suivi : ${responsableAttendu}`) && carteRouverte.includes(`suivi repris par ${responsableAttendu}`), carteRouverte.slice(0, 300));
  if (dir && memeEtab) {
    const aggrDir = (await getJson(dir, "/api/notifications/alertes")).corps.notifications.find((n) => n.id === alerteMoyen.id);
    check("Cloche de la directrice, responsable : aggravation de son suivi (« Votre suivi »)",
      aggrDir?.evenement === "aggravee" && aggrDir.votreSuivi === true, JSON.stringify(aggrDir ?? null));
    await dir.context().close();
  }
  const libelleAggr = await rafraichirCloche(mobile);
  const vueAggr = await ouvrirEtLire(mobile, prenom);
  const boite = await dropdown(mobile).boundingBox();
  check("Cloche admin (375 px) : l'aggravation redevient non lue, « Aggravée : Moyen → Élevé », une seule entrée",
    nonLues(libelleAggr) >= 1 && vueAggr.miseEnAvant && vueAggr.badge === "Aggravée : Moyen → Élevé" && vueAggr.nombre === 1, `${libelleAggr} — ${vueAggr.badge}`);
  check("375 px : panneau de la cloche dans l'écran, pas de défilement horizontal",
    boite.x >= 0 && boite.x + boite.width <= 375 && (await mobile.evaluate(() => document.documentElement.scrollWidth)) <= 375,
    `${Math.round(boite.x)}–${Math.round(boite.x + boite.width)} px`);
  await mobile.screenshot({ path: path.join(CAPTURES, "aggravation-375.png") });
  await mobile.context().close();

  // ── 10. Absence isolée : enregistrée, sans alerte (5 injustifiées nécessaires) ─
  const reponseAbs = ens.waitForResponse((r) => r.url().endsWith("/api/absences") && r.request().method() === "POST");
  await ens.getByRole("button", { name: "Enregistrer l'absence" }).click();
  await reponseAbs;
  const messageAbs = await texte(ens.locator("#new-absence-title ~ div [data-retour]"));
  check("Absence injustifiée isolée : « Absence enregistrée », sans alerte", messageAbs.startsWith("Absence enregistrée") && messageAbs.includes("Aucune alerte"), messageAbs);

  // ── 11. Directeur ─────────────────────────────────────────────────────────────
  if (COMPTES.directeur) {
    const dir = await session(COMPTES.directeur);
    const etabDir = (await getJson(dir, "/api/etudiants?page=1")).corps.elements[0]?.etablissement?.id;
    const pourDir = (await getJson(dir, "/api/notifications/alertes")).corps.notifications.some((n) => n.etudiant.id === etudiantId);
    check(etabDir === etab.id ? "API directeur du même établissement : l'alerte est renvoyée" : "API directeur d'un autre établissement : l'alerte n'est pas renvoyée",
      etabDir === etab.id ? pourDir : !pourDir);
    await dir.context().close();
  } else {
    rapport.ignorer("Périmètre directeur", "E2E_DIRECTEUR_EMAIL et E2E_DIRECTEUR_MOT_DE_PASSE non définis");
  }

  // ── 12. Import CSV : mêmes règles, après toutes les lignes ───────────────────
  const idImport = `e2e-import-${suffixe}`;
  const prenomImport = `Import${suffixe}`;
  const emailImport = `e2e-import-${suffixe}@edutech.test`;
  await creerEleve(idImport, prenomImport);
  await base.query(
    `INSERT INTO "Note" (id, "etudiantId", matiere, valeur, periode, "anneeScolaire") VALUES ($1, $2, 'SVT', 15, $3, $4)`,
    [`e2e-note-imp-${suffixe}`, idImport, PRECEDENTE.periode, PRECEDENTE.annee]
  );
  // Compte élève sans mot de passe utilisable : seul son email sert à l'import
  await base.query(
    `INSERT INTO "User" (id, email, "passwordHash", nom, prenom, role, "etudiantId") VALUES ($1, $2, 'e2e-sans-connexion', $3, $4, 'etudiant', $5)`,
    [`e2e-user-${suffixe}`, emailImport, NOM_TEST, prenomImport, idImport]
  );
  const fichier = path.join(dossierResultats("fichiers"), "import-alertes.csv");
  writeFileSync(fichier, ["email_etudiant,matiere,valeur,periode,anneeScolaire", `${emailImport},SVT,3,${PERIODE},${ANNEE}`, `${emailImport},SVT,4,${PERIODE},${ANNEE}`].join("\n"));
  await ouvrir(ens, "/enseignant/import");
  await ens.locator('input[type="file"]').setInputFiles(fichier);
  const reponseImport = ens.waitForResponse((r) => r.url().includes("/api/notes/import"));
  await ens.getByRole("button", { name: "Importer", exact: true }).click();
  const rapportImport = await (await reponseImport).json();
  await ens.locator("#rapport-titre").waitFor();
  const listeImport = await texte(ens.locator("li", { hasText: prenomImport }));
  check(`Import (3 puis 4 contre 15) : « Alerte déclenchée : niveau Élevé pour ${prenomImport} ${NOM_TEST} » dans le rapport`,
    rapportImport.importees === 2 && rapportImport.alertes.length === 1 && listeImport.startsWith(`Alerte déclenchée : niveau Élevé pour ${prenomImport} ${NOM_TEST}`), listeImport);
  check("Import : une seule alerte en base, calculée sur les deux notes (moyenne 3,5)",
    (await base.query(`SELECT "moyenneApres" FROM "Alerte" WHERE "etudiantId" = $1`, [idImport])).rows.map((r) => r.moyenneApres).join() === "3.5");

  await admin.context().close();
  await ens.context().close();
} finally {
  const supprimes = await nettoyer();
  for (const { id, notificationsVuesLe } of vuesOrigine) {
    await base.query(`UPDATE "User" SET "notificationsVuesLe" = $2 WHERE id = $1`, [id, notificationsVuesLe]);
  }
  const reste = (await base.query(`SELECT count(*)::int AS n FROM "Etudiant" WHERE nom = $1`, [NOM_TEST])).rows[0].n;
  check("Nettoyage : plus aucune donnée de test dans la base de dev, dates de consultation rétablies", reste === 0, `${supprimes} élève(s) supprimé(s)`);
  await base.end();
  await navigateur.close();
}

check("Aucune erreur JS", erreursJs.length === 0, erreursJs.slice(0, 3).join(" ; "));
rapport.terminer();
