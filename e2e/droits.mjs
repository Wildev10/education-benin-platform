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
    !(await visible(etu, /Enregistrer|Supprimer|Importer|Marquer comme traitée/)));
  for (const adresse of ["/enseignant/import", "/admin/utilisateurs", "/enseignant/alertes"]) {
    const arrivee = await forcer(etu, adresse);
    check(`Étudiant : ${adresse} forcée → refusée (renvoyé vers ${arrivee})`, arrivee !== adresse);
  }
  check("Étudiant : l'API refuse import, suppression d'absence, traitement d'alerte, cloche, exports d'alertes, comptes (403)",
    (await Promise.all([
      statut(etu, "POST", "/api/notes/import"),
      statut(etu, "DELETE", "/api/absences/inexistante"),
      statut(etu, "PATCH", "/api/alertes/inexistante", { statut: "traitee" }),
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
  check("Enseignant : pas de cloche (réservée à l'admin et au directeur)", (await cloche(ens).count()) === 0);
  const absenceEns = (await getJson(ens, "/api/absences?page=1")).corps.elements[0];
  await ouvrir(ens, `/enseignant/etudiants/${absenceEns.etudiant.id}`);
  check("Enseignant, fiche : ni emoji ni pictogramme, icônes accessibles", await sobre(ens));
  check("Enseignant, fiche : saisie de notes et d'absences, et « Supprimer » sur les absences",
    (await visible(ens, "Enregistrer la note")) && (await visible(ens, "Enregistrer l'absence")) && (await boutonsSupprimerAbsence(ens).count()) > 0);
  await ouvrir(ens, "/enseignant/alertes");
  check("Enseignant, alertes : « Marquer comme traitée » proposé", await visible(ens, "Marquer comme traitée"));
  await ouvrir(ens, "/enseignant/import");
  check("Enseignant : page d'import accessible", (await ens.locator('input[type="file"]').count()) === 1 && (await visible(ens, "Importer")));
  for (const adresse of ["/admin/utilisateurs", "/directeur"]) {
    const arrivee = await forcer(ens, adresse);
    check(`Enseignant : ${adresse} forcée → refusée (renvoyé vers ${arrivee})`, arrivee !== adresse);
  }
  check("Enseignant : l'API refuse cloche et gestion des comptes (403)",
    (await statut(ens, "GET", "/api/notifications/alertes")) === 403 && (await statut(ens, "GET", "/api/admin/utilisateurs")) === 403);
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
    check("Directeur, fiche : pas de « Marquer comme traitée »", !(await visible(dir, "Marquer comme traitée")));
    await ouvrir(dir, "/directeur/alertes");
    check("Directeur, alertes : pas de « Marquer comme traitée », exports proposés",
      !(await visible(dir, "Marquer comme traitée")) && (await visible(dir, /Exporter en PDF/)) && (await visible(dir, /Excel/)));
    const alerteDir = (await getJson(dir, "/api/alertes?page=1")).corps.elements?.[0];
    check("Directeur : l'API refuse bien les actions masquées (suppression d'absence, import, traitement d'alerte : 403)",
      (await statut(dir, "DELETE", `/api/absences/${idAbsence}`)) === 403 &&
      (await statut(dir, "POST", "/api/notes/import")) === 403 &&
      (await statut(dir, "PATCH", `/api/alertes/${alerteDir?.id ?? "inexistante"}`, { statut: "traitee" })) === 403);
    check("Directeur : l'absence de test n'a pas été supprimée par l'appel refusé",
      (await base.query(`SELECT 1 FROM "Absence" WHERE id = $1`, [idAbsence])).rowCount === 1);
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
  check("Admin, tableau de bord : « Marquer comme traitée » proposé", await visible(admin, "Marquer comme traitée"));
  const fautifs = await admin.evaluate(() =>
    [...document.querySelectorAll("svg")]
      .filter((s) => s.getAttribute("aria-hidden") !== "true" && !(s.getAttribute("role") === "img" && s.getAttribute("aria-label")) && !s.parentElement?.closest('[role="img"][aria-label]'))
      .map((s) => s.outerHTML.slice(0, 80))
  );
  check("Admin, tableau de bord : ni emoji ni pictogramme, icônes accessibles", await sobre(admin), fautifs.join(" | "));
  const sousTitre = (await admin.locator("main p", { hasText: "Périmètre" }).first().innerText()).replace(/\s+/g, " ");
  check("Admin, tableau de bord : sous-titre factuel (périmètre et date des données)",
    /^Périmètre : tous les établissements\. Données du .+, heure du Bénin\.$/.test(sousTitre), sousTitre);
  await ouvrir(admin, "/admin/utilisateurs");
  check("Admin, comptes : ni emoji ni pictogramme, « Voir la fiche » sans flèche", (await sobre(admin)) && (await admin.getByText("Fiche →").count()) === 0);
  check("Admin : gestion des comptes (Nouveau compte, Modifier, Supprimer)",
    (await admin.getByRole("link", { name: /Nouveau compte/ }).count()) === 1 && (await visible(admin, "Modifier")) && (await visible(admin, "Supprimer")));
  const ficheAdmin = (await getJson(admin, "/api/etudiants?page=1")).corps.elements[0];
  await ouvrir(admin, `/admin/etudiants/${ficheAdmin.id}`);
  check("Admin, fiche : « Retour au tableau de bord », ni emoji ni pictogramme", (await admin.getByRole("link", { name: "Retour au tableau de bord" }).count()) === 1 && (await sobre(admin)));
  check("Admin, fiche : consultation et exports, sans formulaire de saisie",
    (await visible(admin, /Exporter en PDF/)) && !(await visible(admin, /Enregistrer la note|Enregistrer l'absence/)));
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
