// Droits affichés par l'interface, pour les 4 rôles : chaque action visible est
// autorisée par l'API, et chaque action interdite n'apparaît pas (navigation,
// boutons, adresses forcées). Pour les actions masquées, l'API répond bien 403.
//
// Écrit dans la base de DEV (garde de commun.mjs) : une absence temporaire dans
// l'établissement du directeur, supprimée à la fin, même en cas d'échec.
import pg from "pg";
import { BASE, COMPTES, connecter, creerRapport, getJson, lancerNavigateur, ouvrir } from "./commun.mjs";

const rapport = creerRapport("Droits par rôle");
const { check } = rapport;
const navigateur = await lancerNavigateur();
const erreursJs = [];
const PREFIXE_TEST = "e2e-droits-";

const base = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
await base.connect();
const nettoyer = async () => (await base.query(`DELETE FROM "Absence" WHERE id LIKE $1`, [`${PREFIXE_TEST}%`])).rowCount;
const restes = await nettoyer();
if (restes) console.log(`   ${restes} absence(s) de test d'un lancement précédent supprimée(s)`);

async function session(compte) {
  const page = await connecter(navigateur, compte);
  page.on("pageerror", (e) => erreursJs.push(`${compte.email} : ${e.message}`));
  return page;
}

/** Statut HTTP d'un appel d'API fait depuis la page, avec la session du rôle. */
const statut = (page, methode, url, corps) =>
  page.evaluate(
    async ([m, u, c]) => (await fetch(u, { method: m, headers: { "Content-Type": "application/json" }, body: c ? JSON.stringify(c) : undefined })).status,
    [methode, url, corps]
  );

/** Question posée à l'assistant avec la session du rôle : corps JSON de la réponse. */
const poser = (page, question) =>
  page.evaluate(
    async (q) => (await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) })).json(),
    question
  );

/** Assistant borné au périmètre : une seule école dans la répartition et dans les résultats, sans date de naissance. */
async function verifierAssistant(page, role) {
  await ouvrir(page, "/enseignant/assistant");
  check(`${role}, assistant : avertissement « aucun nom d'élève » affiché`, (await page.locator("[data-avertissement-assistant]").count()) === 1);
  const repartition = await poser(page, "Répartition des étudiants par établissement");
  const groupes = (repartition.reponse.split(" — ")[1] ?? "").split(" ; ").filter(Boolean);
  check(`${role}, assistant : répartition par établissement limitée à son école`, groupes.length === 1, repartition.reponse);
  const liste = await poser(page, "Liste les alertes actives");
  const ecoles = new Set(liste.donnees.map((a) => a.etudiant?.etablissement?.nom));
  check(`${role}, assistant : alertes renvoyées de son école seulement, sans date de naissance ni sexe`,
    ecoles.size <= 1 && liste.donnees.every((a) => !("dateNaissance" in a.etudiant) && !("sexe" in a.etudiant)),
    `${liste.donnees.length} résultat(s), écoles : ${[...ecoles].join(", ")}`);
}

const libellesNav = async (page) => (await page.locator("nav[aria-label^='Navigation'] a:visible").allTextContents()).map((t) => t.replace(/\s+\d+$/, "").trim());
const visible = async (page, nom) => (await page.getByRole("button", { name: nom }).filter({ visible: true }).count()) > 0;
const cloche = (page) => page.locator('button[aria-haspopup="true"][aria-label^="Notifications"]');
const boutonsSupprimerAbsence = (page) => page.getByRole("button", { name: /^Supprimer l'absence du/ });
const chemin = (page) => new URL(page.url()).pathname;

/** Ni emoji ni pictogramme texte ; toute icône SVG est décorative ou nommée. */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}]|[✓⚠✕✗]/u;
const sobre = async (page) =>
  !EMOJI.test(await page.locator("body").innerText()) &&
  (await page.evaluate(() =>
    [...document.querySelectorAll("svg")].every((s) =>
        s.getAttribute("aria-hidden") === "true" ||
        (s.getAttribute("role") === "img" && !!s.getAttribute("aria-label")) ||
        // graphique : le conteneur role=img porte déjà la description
        !!s.parentElement?.closest('[role="img"][aria-label]'))
  ));

/** Ouvre une adresse forcée à la main et renvoie le chemin d'arrivée. */
async function forcer(page, adresse) {
  await page.goto(`${BASE}${adresse}`);
  await page.waitForLoadState("networkidle");
  return chemin(page);
}

try {
  // ── ÉTUDIANT ───────────────────────────────────────────────────────────────
  const etu = await session(COMPTES.etudiant);
  await ouvrir(etu, "/etudiant");
  check("Étudiant, espace : ni emoji ni pictogramme, icônes accessibles", await sobre(etu));
  check("Étudiant : seul export proposé, l'Excel de sa fiche", await visible(etu, /Télécharger ma fiche/) && !(await visible(etu, /PDF/)));
  check("Étudiant : ni navigation d'espace, ni cloche, ni saisie, suppression, import ou traitement",
    (await libellesNav(etu)).length === 0 && (await cloche(etu).count()) === 0 &&
    !(await visible(etu, /Enregistrer|Supprimer|Importer|Ajouter une action|Résoudre|Rouvrir/)));
  for (const adresse of ["/enseignant/import", "/admin/utilisateurs", "/enseignant/alertes"]) {
    const arrivee = await forcer(etu, adresse);
    check(`Étudiant : ${adresse} forcée → refusée (renvoyé vers ${arrivee})`, arrivee !== adresse);
  }
  check("Étudiant : l'API refuse import, suppression d'absence, suivi d'alerte, cloche, exports d'alertes, comptes (403)",
    (await Promise.all([
      statut(etu, "POST", "/api/notes/import"),
      statut(etu, "DELETE", "/api/absences/inexistante"),
      statut(etu, "POST", "/api/alertes/inexistante/suivis", { transition: "suivre" }),
      statut(etu, "GET", "/api/notifications/alertes"),
      statut(etu, "GET", "/api/alertes/xlsx"),
      statut(etu, "GET", "/api/admin/utilisateurs"),
    ])).every((s) => s === 403));
  await etu.context().close();

  // ── ENSEIGNANT ─────────────────────────────────────────────────────────────
  const ens = await session(COMPTES.enseignant);
  await ouvrir(ens, "/enseignant");
  const navEns = await libellesNav(ens);
  check("Enseignant : navigation avec Importer, Alertes, Absences, Assistant ; sans Utilisateurs ni Historique",
    ["Importer", "Alertes", "Absences", "Assistant"].every((l) => navEns.includes(l)) && !navEns.some((l) => /Utilisateurs|Historique/.test(l)), navEns.join(", "));
  check("Enseignant : cloche affichée (alertes de son établissement)", (await cloche(ens).count()) === 1);
  const absenceEns = (await getJson(ens, "/api/absences?page=1")).corps.elements[0];
  await ouvrir(ens, `/enseignant/etudiants/${absenceEns.etudiant.id}`);
  check("Enseignant, fiche : ni emoji ni pictogramme, icônes accessibles", await sobre(ens));
  check("Enseignant, fiche : saisie de notes et d'absences, et « Supprimer » sur les absences",
    (await visible(ens, "Enregistrer la note")) && (await visible(ens, "Enregistrer l'absence")) && (await boutonsSupprimerAbsence(ens).count()) > 0);
  await ouvrir(ens, "/enseignant/alertes");
  check("Enseignant, alertes : « Suivre l'alerte » proposé, vers la fiche", (await ens.getByRole("link", { name: /^Suivre l'alerte/ }).count()) > 0);
  await ouvrir(ens, "/enseignant/import");
  check("Enseignant : page d'import accessible", (await ens.locator('input[type="file"]').count()) === 1 && (await visible(ens, "Importer")));
  for (const adresse of ["/admin/utilisateurs", "/directeur"]) {
    const arrivee = await forcer(ens, adresse);
    check(`Enseignant : ${adresse} forcée → refusée (renvoyé vers ${arrivee})`, arrivee !== adresse);
  }
  check("Enseignant : l'API ouvre la cloche (200) et refuse la gestion des comptes (403)",
    (await statut(ens, "GET", "/api/notifications/alertes")) === 200 && (await statut(ens, "GET", "/api/admin/utilisateurs")) === 403);
  await verifierAssistant(ens, "Enseignant");
  await ens.context().close();

  // ── DIRECTEUR ──────────────────────────────────────────────────────────────
  if (COMPTES.directeur) {
    const dir = await session(COMPTES.directeur);
    await ouvrir(dir, "/directeur");
    const navDir = await libellesNav(dir);
    check("Directeur : navigation sans « Importer »", !navDir.includes("Importer") && navDir.includes("Alertes"), navDir.join(", "));
    check("Directeur : cloche affichée", (await cloche(dir).count()) === 1);
    check("Directeur, tableau de bord : ni emoji ni pictogramme, icônes accessibles", await sobre(dir));
    const arrivee = await forcer(dir, "/enseignant/import");
    check(`Directeur : /enseignant/import forcée → renvoyé vers ${arrivee}`, arrivee === "/directeur");

    // Absence temporaire dans son établissement, pour voir la fiche comme en vrai
    const eleve = (await getJson(dir, "/api/etudiants?page=1")).corps.elements[0];
    const idAbsence = `${PREFIXE_TEST}${Date.now().toString(36)}`;
    await base.query(
      `INSERT INTO "Absence" (id, "etudiantId", date, motif, periode, "anneeScolaire") VALUES ($1, $2, now(), 'injustifiee', 'Trimestre 1', '2025-2026')`,
      [idAbsence, eleve.id]
    );
    await ouvrir(dir, `/enseignant/etudiants/${eleve.id}`);
    check("Directeur, fiche : l'absence est listée mais sans bouton « Supprimer »",
      (await dir.locator("text=Injustifiée").count()) > 0 && (await boutonsSupprimerAbsence(dir).count()) === 0);
    check("Directeur, fiche : saisie de notes et d'absences proposée (autorisée par l'API)",
      (await visible(dir, "Enregistrer la note")) && (await visible(dir, "Enregistrer l'absence")));
    await ouvrir(dir, "/directeur/alertes");
    check("Directeur, alertes : « Suivre l'alerte » et exports proposés",
      (await dir.getByRole("link", { name: /^Suivre l'alerte/ }).count()) > 0 && (await visible(dir, /Exporter en PDF/)) && (await visible(dir, /Excel/)));
    const alerteDir = (await getJson(dir, "/api/alertes?page=1")).corps.elements?.[0];
    await ouvrir(dir, `/enseignant/etudiants/${alerteDir.etudiant.id}`);
    check("Directeur, fiche d'un élève en alerte : suivi proposé (« Ajouter une action », « Résoudre l'alerte »)",
      (await visible(dir, "Ajouter une action")) && (await visible(dir, "Résoudre l'alerte")));
    check("Directeur : l'API refuse les actions masquées (suppression d'absence, import : 403) et accepte le suivi (saisie incomplète : 400, rien d'écrit)",
      (await statut(dir, "DELETE", `/api/absences/${idAbsence}`)) === 403 &&
      (await statut(dir, "POST", "/api/notes/import")) === 403 &&
      (await statut(dir, "POST", `/api/alertes/${alerteDir.id}/suivis`, { transition: "suivre" })) === 400);
    check("Directeur : l'absence de test n'a pas été supprimée par l'appel refusé",
      (await base.query(`SELECT 1 FROM "Absence" WHERE id = $1`, [idAbsence])).rowCount === 1);
    await verifierAssistant(dir, "Directeur");
    await dir.context().close();
  } else {
    rapport.ignorer("Directeur : droits affichés", "E2E_DIRECTEUR_EMAIL et E2E_DIRECTEUR_MOT_DE_PASSE non définis");
  }

  // ── ADMIN ──────────────────────────────────────────────────────────────────
  const admin = await session(COMPTES.admin);
  await ouvrir(admin, "/admin");
  const navAdmin = await libellesNav(admin);
  check("Admin : navigation complète (Utilisateurs, Importer, Historique, Assistant) et cloche",
    ["Utilisateurs", "Importer", "Historique", "Assistant"].every((l) => navAdmin.includes(l)) && (await cloche(admin).count()) === 1, navAdmin.join(", "));
  check("Admin, tableau de bord : consultation seule (« Voir le suivi », pilotage du suivi, aucune action)",
    (await admin.getByRole("link", { name: /^Voir le suivi/ }).count()) > 0 && (await admin.locator("[data-pilotage-suivi]").count()) === 1 &&
      !(await visible(admin, /Ajouter une action|Résoudre l'alerte|Marquer comme traitée/)));
  const alerteAdmin = (await getJson(admin, "/api/alertes?page=1")).corps.elements[0];
  check("Admin : l'API refuse le suivi d'une alerte (403)",
    (await statut(admin, "POST", `/api/alertes/${alerteAdmin.id}/suivis`, { transition: "suivre", action: "autre", commentaire: "Tentative de l'admin." })) === 403);
  await ouvrir(admin, `/admin/etudiants/${alerteAdmin.etudiant.id}`);
  check("Admin, fiche d'un élève en alerte : statut et historique visibles, sans action de suivi",
    (await admin.locator('section[aria-labelledby="alerts-title"] article').count()) > 0 && !(await visible(admin, /Ajouter une action|Résoudre l'alerte|Rouvrir/)));
  await ouvrir(admin, "/admin");
  const fautifs = await admin.evaluate(() =>
    [...document.querySelectorAll("svg")]
      .filter((s) => s.getAttribute("aria-hidden") !== "true" && !(s.getAttribute("role") === "img" && s.getAttribute("aria-label")) && !s.parentElement?.closest('[role="img"][aria-label]'))
      .map((s) => s.outerHTML.slice(0, 80))
  );
  check("Admin, tableau de bord : ni emoji ni pictogramme, icônes accessibles", await sobre(admin), fautifs.join(" | "));
  const sousTitre = (await admin.locator("[data-mise-a-jour] p").first().innerText()).replace(/\s+/g, " ");
  check("Admin, tableau de bord : ligne d'information (périmètre, heure des données, ancienneté)",
    /^Tous les établissements · Mis à jour à \d{1,2} h \d{2} ?, heure du Bénin · (à l'instant|il y a \d+ min)$/.test(sousTitre), sousTitre);
  await ouvrir(admin, "/admin/utilisateurs");
  check("Admin, comptes : ni emoji ni pictogramme, « Voir la fiche » sans flèche", (await sobre(admin)) && (await admin.getByText("Fiche →").count()) === 0);
  check("Admin : gestion des comptes (Nouveau compte, Modifier, Supprimer)",
    (await admin.getByRole("link", { name: /Nouveau compte/ }).count()) === 1 && (await visible(admin, "Modifier")) && (await visible(admin, "Supprimer")));
  const ficheAdmin = (await getJson(admin, "/api/etudiants?page=1")).corps.elements[0];
  await ouvrir(admin, `/admin/etudiants/${ficheAdmin.id}`);
  check("Admin, fiche : « Retour au tableau de bord », ni emoji ni pictogramme", (await admin.getByRole("link", { name: "Retour au tableau de bord" }).count()) === 1 && (await sobre(admin)));
  check("Admin, fiche : consultation et exports, sans formulaire de saisie",
    (await visible(admin, /Exporter en PDF/)) && !(await visible(admin, /Enregistrer la note|Enregistrer l'absence/)));
  const repartitionAdmin = await poser(admin, "Répartition des étudiants par établissement");
  check("Admin, assistant : répartition nationale (plusieurs établissements)",
    (repartitionAdmin.reponse.split(" — ")[1] ?? "").split(" ; ").length > 1, repartitionAdmin.reponse);
  await admin.context().close();
} finally {
  const supprimees = await nettoyer();
  check("Nettoyage : plus aucune absence de test dans la base de dev", (await base.query(`SELECT 1 FROM "Absence" WHERE id LIKE $1`, [`${PREFIXE_TEST}%`])).rowCount === 0,
    `${supprimees} supprimée(s)`);
  await base.end();
  await navigateur.close();
}

check("Aucune erreur JS", erreursJs.length === 0, erreursJs.slice(0, 3).join(" ; "));
rapport.terminer();
