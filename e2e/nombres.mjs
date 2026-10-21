// Format français des nombres et libellé des périodes, sur les pages principales
// de chaque rôle (cloche ouverte, graphiques compris) : aucun nombre décimal au
// format anglais (« 12.5 », « −35.0 % »), aucune période « Trimestre 1 2026-2027 »
// où le numéro et l'année se collent. Aucune écriture en base.
import { COMPTES, connecter, creerRapport, getJson, lancerNavigateur, ouvrir } from "./commun.mjs";

const rapport = creerRapport("Nombres et périodes");
const { check } = rapport;
const navigateur = await lancerNavigateur();

// Décimal anglais : chiffres, point, chiffres, isolé (pas une date, une version ou un nom de fichier)
const DECIMAL_ANGLAIS = /(?<![\d\w.,/])\d+\.\d+(?![\d\w.])/;
// Ancien libellé de période : numéro et année séparés par une espace ordinaire
const PERIODE_COLLEE = /(?:Trimestre|T)\s?\d[ (]+\d{2,4}-\d{2,4}/;
const DECIMAL_FRANCAIS = /\d,\d/;

/** Chaque nœud de texte de la page (masqués compris : trimestres repliés) et les aria-label, séparément. */
function textesDeLaPage(page) {
  return page.evaluate(() => {
    const textes = [];
    const parcours = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(n.parentElement?.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    while (parcours.nextNode()) {
      const t = parcours.currentNode.textContent.trim();
      if (t) textes.push(t);
    }
    for (const el of document.querySelectorAll("[aria-label]")) textes.push(el.getAttribute("aria-label"));
    return textes;
  });
}

async function verifier(page, role, libelle) {
  const textes = await textesDeLaPage(page);
  const anglais = textes.filter((t) => DECIMAL_ANGLAIS.test(t));
  const periodes = textes.filter((t) => PERIODE_COLLEE.test(t));
  check(`${role}, ${libelle} : aucun nombre décimal au format anglais`, anglais.length === 0, anglais.slice(0, 3).join(" | "));
  check(`${role}, ${libelle} : périodes au format « Trimestre 1 · 2026-2027 »`, periodes.length === 0, periodes.slice(0, 3).join(" | "));
  return textes;
}

/** Ouvre la cloche et vérifie la liste des dernières alertes. */
async function verifierCloche(page, role) {
  await page.locator('button[aria-label^="Notifications"]').first().click();
  await page.locator('[aria-label="Dernières alertes"]').first().waitFor({ timeout: 15000 });
  await verifier(page, role, "cloche ouverte");
  await page.keyboard.press("Escape");
}

/** Un élève avec une alerte de chaque type, dans le périmètre du compte. */
async function elevesAvecAlertes(page) {
  const { corps } = await getJson(page, "/api/alertes?statut=toutes&page=1&taille=100");
  const alertes = corps?.elements ?? [];
  return {
    notes: alertes.find((a) => a.type === "baisse_moyenne")?.etudiant?.id ?? null,
    absences: alertes.find((a) => a.type === "absences")?.etudiant?.id ?? null,
  };
}

const PAGES = {
  admin: (e) => ["/admin", "/admin/alertes?statut=toutes", "/admin/etudiants", "/admin/absences", "/admin/historique", "/admin/utilisateurs",
    ...[e.notes, e.absences].filter(Boolean).map((id) => `/admin/etudiants/${id}`)],
  enseignant: (e) => ["/enseignant", "/enseignant/alertes?statut=toutes", "/enseignant/absences",
    ...[e.notes, e.absences].filter(Boolean).map((id) => `/enseignant/etudiants/${id}`)],
  directeur: () => ["/directeur", "/directeur/alertes?statut=toutes", "/directeur/absences"],
  etudiant: () => ["/etudiant", "/profil"],
};

for (const [role, pages] of Object.entries(PAGES)) {
  const compte = COMPTES[role];
  if (!compte) {
    rapport.ignorer(`Nombres ${role}`, "compte de test non défini");
    continue;
  }
  const page = await connecter(navigateur, compte);
  const eleves = role === "etudiant" ? {} : await elevesAvecAlertes(page);
  for (const chemin of pages(eleves)) {
    await ouvrir(page, chemin);
    // Graphiques : rendus côté navigateur
    if (await page.locator('[role="img"]').count()) await page.locator('[role="img"] svg').first().waitFor({ timeout: 15000 }).catch(() => {});
    const textes = await verifier(page, role, chemin);
    if (chemin.includes("/alertes")) {
      check(`${role}, ${chemin} : moyennes affichées avec une virgule`, textes.some((t) => DECIMAL_FRANCAIS.test(t)), textes.find((t) => DECIMAL_FRANCAIS.test(t)) ?? "aucune");
    }
  }
  if (role !== "etudiant") await verifierCloche(page, role);
  await page.context().close();
}

await navigateur.close();
rapport.terminer();
