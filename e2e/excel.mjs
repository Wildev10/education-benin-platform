// Exports Excel de bout en bout, pour les 4 rôles : contenu, mise en forme,
// périmètre (forçage d'identifiant → 404) et exports complets malgré la pagination.
// Les élèves et établissements testés sont découverts via l'API, sans identifiant en dur.
import { rmSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import {
  AUJOURDHUI,
  BASE,
  COMPTES,
  connecter,
  creerRapport,
  dossierResultats,
  getJson,
  lancerNavigateur,
  ouvrir,
  statut,
} from "./commun.mjs";

const rapport = creerRapport("Exports Excel");
const { check } = rapport;
const DOSSIER = dossierResultats("telechargements");
rmSync(DOSSIER, { recursive: true, force: true });
dossierResultats("telechargements");

const navigateur = await lancerNavigateur();
const erreursJs = [];
const session = async (compte) => {
  const page = await connecter(navigateur, compte, { telechargements: true });
  page.on("pageerror", (e) => erreursJs.push(`${compte.email} : ${e.message}`));
  return page;
};

/** Clique sur un bouton d'export, enregistre le fichier et le relit avec ExcelJS. */
async function telecharger(page, bouton) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), bouton.click()]);
  const chemin = path.join(DOSSIER, dl.suggestedFilename());
  await dl.saveAs(chemin);
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.readFile(chemin);
  return { nom: dl.suggestedFilename(), classeur };
}

/** Télécharge une URL d'export depuis la page (pour les URL forcées à la main). */
async function telechargerUrl(page, url, nom) {
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.evaluate(
      async ([u, n]) => {
        const r = await fetch(u);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(await r.blob());
        a.download = n;
        document.body.appendChild(a);
        a.click();
      },
      [url, nom]
    ),
  ]);
  const chemin = path.join(DOSSIER, nom);
  await dl.saveAs(chemin);
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.readFile(chemin);
  return classeur;
}

function ligneTitres(feuille, premier) {
  let n = null;
  feuille.eachRow((r) => {
    if (n === null && r.getCell(1).value === premier) n = r.number;
  });
  return n;
}
/** Lignes de données sous la ligne de titres, sans la ligne « Total ». */
function lignesDonnees(feuille, premier) {
  const debut = ligneTitres(feuille, premier);
  const lignes = [];
  feuille.eachRow((r) => {
    const v = r.getCell(1).value;
    if (r.number > debut && v !== null && !String(v).startsWith("Total")) lignes.push(r);
  });
  return lignes;
}
/** Année scolaire annoncée dans l'en-tête d'une feuille (« Année scolaire 2025-2026 … »). */
function anneeDeLaFeuille(feuille) {
  for (let i = 1; i <= 8; i++) {
    const m = String(feuille.getCell(`A${i}`).value ?? "").match(/Année scolaire (\d{4}-\d{4})/);
    if (m) return m[1];
  }
  return null;
}
// Année scolaire en cours au Bénin (même règle que src/lib/annee-scolaire.ts)
const [anJour, moisJour] = AUJOURDHUI.split("-").map(Number);
const ANNEE_EN_COURS = moisJour >= 9 ? `${anJour}-${anJour + 1}` : `${anJour - 1}-${anJour}`;
const moyenne = (xs) => (xs.length ? Math.round((xs.reduce((s, v) => s + v, 0) / xs.length) * 100) / 100 : null);
const slug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
const elevesDe = async (page, etablissement = "") =>
  (await getJson(page, `/api/etudiants?page=1&taille=100${etablissement ? `&etablissement=${etablissement}` : ""}`)).corps;

// ══ Découverte des données ════════════════════════════════════════════════════
const ens = await session(COMPTES.enseignant);
const listeEns = await elevesDe(ens);
const ELEVE_ENS = listeEns.elements[0];
const ETAB_ENS = ELEVE_ENS.etablissement;

const admin = await session(COMPTES.admin);
const etablissements = (await getJson(admin, "/api/etablissements")).corps;

let dir = null;
let listeDir = null;
if (COMPTES.directeur) {
  dir = await session(COMPTES.directeur);
  listeDir = await elevesDe(dir);
}
const ELEVE_DIR = listeDir?.elements[0];
const ETAB_DIR = ELEVE_DIR?.etablissement;
// Ni celui de l'enseignant, ni celui du directeur (les deux peuvent être le même)
const ETAB_AUTRE = etablissements.find((e) => e.id !== ETAB_ENS.id && e.id !== ETAB_DIR?.id);
const listeAutre = await elevesDe(admin, ETAB_AUTRE.id);
const ELEVE_AUTRE = listeAutre.elements[0];
console.log(`   Enseignant : ${ETAB_ENS.nom}${ETAB_DIR ? ` · directeur : ${ETAB_DIR.nom}` : ""} · autre établissement : ${ETAB_AUTRE.nom}`);

// ══ ADMIN ═════════════════════════════════════════════════════════════════════
let f = await telecharger(admin, admin.getByRole("button", { name: "Excel" }).first());
let feuille = f.classeur.getWorksheet("Alertes");
let lignes = lignesDonnees(feuille, "Nom");
const nbActivesPage = Number.parseInt(await admin.locator("#alerts-title span").textContent(), 10);
check("Admin, dashboard : Excel des alertes actives = alertes affichées",
  lignes.length === nbActivesPage && f.nom === `alertes-${AUJOURDHUI}.xlsx`, `${lignes.length} lignes / ${nbActivesPage} à l'écran — ${f.nom}`);
check("… en-tête : plateforme, « Tous les établissements », date, ligne figée",
  feuille.getCell("A1").value.startsWith("EduTech Bénin") && feuille.getCell("A3").value === "Établissement : Tous les établissements" &&
  String(feuille.getCell("A4").value).startsWith("Exporté le") && feuille.views[0].state === "frozen");
const cellNiveau = lignes.map((r) => r.getCell(6)).find((c) => c.value === "Élevé");
// Colonne retrouvée par son titre : de nouvelles colonnes (responsable, motif) ne la déplacent pas pour le test
let colAvant = 0;
feuille.eachRow((r) => r.eachCell((c, n) => { if (c.value === "Moyenne avant") colAvant = n; }));
const ligneNotes = lignes.find((r) => r.getCell(5).value === "Notes");
check("… niveau Élevé coloré, moyennes en vrais nombres (0.00)",
  colAvant > 0 && (!cellNiveau || cellNiveau.fill?.fgColor?.argb === "FFFEE2E2") &&
    (!ligneNotes || (typeof ligneNotes.getCell(colAvant).value === "number" && ligneNotes.getCell(colAvant).numFmt === "0.00")),
  `colonne « Moyenne avant » : ${colAvant}`);

f = await telecharger(admin, admin.getByRole("button", { name: `Exporter la liste des élèves de ${ETAB_AUTRE.nom} en Excel` }));
feuille = f.classeur.getWorksheet("Élèves");
lignes = lignesDonnees(feuille, "Nom");
check(`Admin, tableau des établissements : liste des élèves de ${ETAB_AUTRE.nom} complète`,
  lignes.length === listeAutre.total && f.nom === `eleves-${slug(ETAB_AUTRE.nom)}-${AUJOURDHUI}.xlsx`,
  `${lignes.length} élèves / ${listeAutre.total} via l'API — ${f.nom}`);
check("… colonnes attendues", JSON.stringify(feuille.getRow(ligneTitres(feuille, "Nom")).values.slice(1)) ===
  JSON.stringify(["Nom", "Prénom", "Classe", "Moyenne Trimestre 1", "Moyenne Trimestre 2", "Moyenne Trimestre 3", "Moyenne générale", "Absences injustifiées", "Alerte active"]));
const annee = anneeDeLaFeuille(feuille);
const ligneAutre = lignes.find((r) => r.getCell(1).value === ELEVE_AUTRE.nom && r.getCell(2).value === ELEVE_AUTRE.prenom);
const notesAutre = (await getJson(admin, `/api/notes?etudiantId=${ELEVE_AUTRE.id}`)).corps;
const t3Attendu = moyenne(notesAutre.filter((n) => n.periode === "Trimestre 3" && n.anneeScolaire === annee).map((n) => n.valeur));
check(`… moyenne T3 de ${ELEVE_AUTRE.prenom} ${ELEVE_AUTRE.nom} identique au calcul depuis l'API`,
  (ligneAutre?.getCell(6).value ?? null) === t3Attendu, `${ligneAutre?.getCell(6).value} / ${t3Attendu} (${annee})`);

await ouvrir(admin, "/admin/alertes?niveau=eleve&statut=toutes");
const nbFiltre = Number.parseInt(await admin.locator('main [role="status"]').first().textContent(), 10);
f = await telecharger(admin, admin.getByRole("button", { name: "Excel" }));
feuille = f.classeur.getWorksheet("Alertes");
lignes = lignesDonnees(feuille, "Nom");
check("Admin, page Alertes filtrée : l'Excel respecte les filtres",
  lignes.length === nbFiltre && lignes.every((r) => r.getCell(6).value === "Élevé") && feuille.getCell("A5").value === "Filtres : Tous statuts · Risque élevé",
  `${lignes.length} / ${nbFiltre} — ${feuille.getCell("A5").value}`);

// Export lancé depuis une page paginée (page 2, ou page 1 si tout tient sur une page) : la totalité
await ouvrir(admin, "/admin/alertes?statut=toutes&page=2");
const nbToutes = Number.parseInt(await admin.locator('main [role="status"]').first().textContent(), 10);
const cartes = await admin.locator("main article").count();
f = await telecharger(admin, admin.getByRole("button", { name: "Excel" }));
lignes = lignesDonnees(f.classeur.getWorksheet("Alertes"), "Nom");
check("Admin, export depuis une page paginée : toutes les alertes filtrées, pas seulement la page",
  lignes.length === nbToutes, `${lignes.length} lignes, ${nbToutes} au total, ${cartes} sur la page affichée (${new URL(admin.url()).search || "page 1"})`);

await ouvrir(admin, `/admin/etudiants/${ELEVE_ENS.id}`);
f = await telecharger(admin, admin.getByRole("button", { name: "Excel" }));
check("Admin, fiche élève : 4 feuilles, nom de fichier clair",
  JSON.stringify(f.classeur.worksheets.map((w) => w.name)) === JSON.stringify(["Identité", "Notes", "Absences", "Alertes"]) &&
  f.nom === `fiche-${slug(ELEVE_ENS.nom)}-${slug(ELEVE_ENS.prenom)}-${AUJOURDHUI}.xlsx`, f.nom);
const anneeFiche = String(lignesDonnees(f.classeur.getWorksheet("Identité"), "Rubrique").find((r) => r.getCell(1).value === "Année scolaire")?.getCell(2).value ?? "");
check(`Admin, fiche élève : année scolaire en cours au Bénin (${ANNEE_EN_COURS})`, anneeFiche === ANNEE_EN_COURS, anneeFiche);
// Année du tableau des notes : l'année en cours, ou le récapitulatif de l'année précédente
const feuilleNotes = f.classeur.getWorksheet("Notes");
const enTeteNotes = [];
feuilleNotes.eachRow((r) => enTeteNotes.push(String(r.getCell(1).value ?? "")));
const recapitulatif = enTeteNotes.some((l) => l === `Aucune note pour l'année ${ANNEE_EN_COURS} pour l'instant.`);
let anneeNotes = anneeFiche;
feuilleNotes.eachRow((r) => {
  const m = String(r.getCell(2).value ?? "").match(/^Trimestre 1 (\d{4}-\d{4})$/);
  if (m) anneeNotes = m[1];
});
check(recapitulatif ? `… pas encore de note en ${ANNEE_EN_COURS} : message, puis récapitulatif ${anneeNotes} annoncé` : `… notes de ${anneeNotes}`,
  recapitulatif ? enTeteNotes.includes(`Récapitulatif de l'année ${anneeNotes} — moyennes sur 20`) : anneeNotes === ANNEE_EN_COURS, enTeteNotes.slice(3, 6).join(" | "));
const premiereMatiere = lignesDonnees(feuilleNotes, "Matière")[0];
if (premiereMatiere) {
  const matiere = premiereMatiere.getCell(1).value;
  const notesEns = (await getJson(admin, `/api/notes?etudiantId=${ELEVE_ENS.id}`)).corps;
  const attenduT1 = moyenne(notesEns.filter((n) => n.matiere === matiere && n.periode === "Trimestre 1" && n.anneeScolaire === anneeNotes).map((n) => n.valeur));
  check(`… moyenne de ${matiere} au T1 identique au calcul depuis l'API`, (premiereMatiere.getCell(2).value ?? null) === attenduT1,
    `${premiereMatiere.getCell(2).value} / ${attenduT1}`);
} else {
  rapport.ignorer("… moyenne au T1", "aucune note pour cet élève");
}
const [dlPdf] = await Promise.all([admin.waitForEvent("download"), admin.getByRole("button", { name: "Exporter en PDF" }).click()]);
check("Admin, fiche élève : le bouton PDF fonctionne toujours", dlPdf.suggestedFilename().endsWith(".pdf"), dlPdf.suggestedFilename());
await admin.context().close();

// ══ DIRECTEUR ═════════════════════════════════════════════════════════════════
if (!dir) {
  rapport.ignorer("Directeur : exports et forçages", "E2E_DIRECTEUR_EMAIL et E2E_DIRECTEUR_MOT_DE_PASSE non définis");
} else {
  await ouvrir(dir, "/directeur");
  f = await telecharger(dir, dir.getByRole("button", { name: "Exporter la liste des élèves (Excel)" }));
  feuille = f.classeur.getWorksheet("Élèves");
  lignes = lignesDonnees(feuille, "Nom");
  check("Directeur, tableau de bord : liste des élèves de son établissement",
    feuille.getCell("A3").value === `Établissement : ${ETAB_DIR.nom}` && lignes.length === listeDir.total, `${lignes.length} élèves — ${f.nom}`);
  await ouvrir(dir, "/directeur/alertes?statut=toutes");
  f = await telecharger(dir, dir.getByRole("button", { name: "Excel" }));
  lignes = lignesDonnees(f.classeur.getWorksheet("Alertes"), "Nom");
  check("Directeur, page Alertes : uniquement son établissement", lignes.every((r) => r.getCell(4).value === ETAB_DIR.nom), `${lignes.length} alertes`);
  await ouvrir(dir, `/enseignant/etudiants/${ELEVE_DIR.id}`);
  f = await telecharger(dir, dir.getByRole("button", { name: "Excel" }));
  check("Directeur, fiche d'un élève de son établissement",
    f.classeur.getWorksheet("Identité").getCell("A2").value === `Fiche de suivi — ${ELEVE_DIR.prenom} ${ELEVE_DIR.nom}`, f.nom);
  check("Directeur, forçage : liste des élèves d'un autre établissement → 404", (await statut(dir, `/api/etablissements/${ETAB_AUTRE.id}/eleves/xlsx`)) === 404);
  check("Directeur, forçage : fiche Excel d'un élève d'un autre établissement → 404", (await statut(dir, `/api/etudiants/${ELEVE_AUTRE.id}/xlsx`)) === 404);
  const force = await telechargerUrl(dir, `/api/alertes/xlsx?statut=toutes&etablissement=${ETAB_AUTRE.id}`, "alertes-force.xlsx");
  const lignesForce = lignesDonnees(force.getWorksheet("Alertes"), "Nom");
  check("Directeur, forçage : ?etablissement= d'un autre dans l'export des alertes → uniquement le sien",
    lignesForce.every((r) => r.getCell(4).value === ETAB_DIR.nom), `${lignesForce.length} alertes`);
  await dir.context().close();
}

// ══ ENSEIGNANT ════════════════════════════════════════════════════════════════
await ouvrir(ens, `/enseignant/etudiants/${ELEVE_ENS.id}`);
f = await telecharger(ens, ens.getByRole("button", { name: "Excel" }));
const identite = f.classeur.getWorksheet("Identité");
check("Enseignant, fiche de son élève : identité complète", identite.getCell("A3").value === `Établissement : ${ETAB_ENS.nom}` &&
  lignesDonnees(identite, "Rubrique").find((r) => r.getCell(1).value === "Date de naissance")?.getCell(2).value instanceof Date, f.nom);
await ouvrir(ens, "/enseignant/alertes");
f = await telecharger(ens, ens.getByRole("button", { name: "Excel" }));
lignes = lignesDonnees(f.classeur.getWorksheet("Alertes"), "Nom");
check("Enseignant, page Alertes : uniquement son établissement", lignes.every((r) => r.getCell(4).value === ETAB_ENS.nom), `${lignes.length} alertes`);
check("Enseignant, forçage : fiche Excel d'un élève d'un autre établissement → 404", (await statut(ens, `/api/etudiants/${ELEVE_AUTRE.id}/xlsx`)) === 404);
check("Enseignant, forçage : liste des élèves d'un autre établissement → 404", (await statut(ens, `/api/etablissements/${ETAB_AUTRE.id}/eleves/xlsx`)) === 404);
check("Enseignant : liste des élèves de son établissement → 200", (await statut(ens, `/api/etablissements/${ETAB_ENS.id}/eleves/xlsx`)) === 200);
await ens.context().close();

// ══ ÉTUDIANT ══════════════════════════════════════════════════════════════════
const etu = await session(COMPTES.etudiant);
f = await telecharger(etu, etu.getByRole("button", { name: "Télécharger ma fiche (Excel)" }));
const titre = f.classeur.getWorksheet("Identité").getCell("A2").value;
// L'élève ne voit pas ses alertes : 3 feuilles (Identité, Notes, Absences), sans « Alertes »
check("Étudiant : sa propre fiche Excel, sans feuille Alertes", titre.startsWith("Fiche de suivi —") && f.classeur.worksheets.length === 3 && !f.classeur.getWorksheet("Alertes"),
  `${titre} — ${f.nom} — ${f.classeur.worksheets.map((w) => w.name).join(", ")}`);
// Un élève qui n'est pas lui : le premier des deux listes dont le nom diffère du sien
const autreQueMoi = [ELEVE_AUTRE, ...listeAutre.elements, ...listeEns.elements].find((e) => !titre.endsWith(`${e.prenom} ${e.nom}`));
check("Étudiant, forçage : fiche d'un autre élève → 404", (await statut(etu, `/api/etudiants/${autreQueMoi.id}/xlsx`)) === 404);
check("Étudiant : liste des élèves → refusée (403)", (await statut(etu, `/api/etablissements/${ETAB_AUTRE.id}/eleves/xlsx`)) === 403);
check("Étudiant : export des alertes → refusé (403)", (await statut(etu, "/api/alertes/xlsx")) === 403);
await etu.context().close();

// Non connecté
const anonyme = await (await navigateur.newContext()).newPage();
await anonyme.goto(`${BASE}/login`);
check("Non connecté : fiche Excel → 401", (await statut(anonyme, `/api/etudiants/${ELEVE_ENS.id}/xlsx`)) === 401);

await navigateur.close();
check("Aucune erreur JS", erreursJs.length === 0, erreursJs.slice(0, 3).join(" ; "));
rapport.terminer();
