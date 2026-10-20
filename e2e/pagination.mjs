// Pagination côté serveur : navigation, taille de page, filtres, bornes,
// périmètre du total, et affichage à 375 px et 1280 px (captures dans e2e/resultats/captures).
import path from "node:path";
import { BASE, COMPTES, connecter, creerRapport, dossierResultats, getJson, lancerNavigateur, ouvrir } from "./commun.mjs";

const rapport = creerRapport("Pagination");
const { check } = rapport;
const CAPTURES = dossierResultats("captures");
const navigateur = await lancerNavigateur();
const erreursJs = [];

async function session(compte, options) {
  const page = await connecter(navigateur, compte, options);
  page.on("pageerror", (e) => erreursJs.push(`${compte.email} : ${e.message}`));
  return page;
}

const nav = (page, libelle) => page.locator(`nav[aria-label="${libelle}"]`);
const plage = (page, libelle) => nav(page, libelle).locator("p").first();
const params = (page) => new URL(page.url()).searchParams;
const nombre = (texte) => Number.parseInt(String(texte).replace(/\s/g, ""), 10);
const NB = new Intl.NumberFormat("fr-FR");
const libellePlage = (page, taille, total) =>
  total === 0
    ? "0 sur 0"
    : `${NB.format((page - 1) * taille + 1)}–${NB.format(Math.min(page * taille, total))} sur ${NB.format(total)}`;
const normaliser = (t) => (t ?? "").replace(/\s/g, " ").trim();

/** Attend que la plage affichée devienne `attendu` (navigation côté client terminée). */
async function attendrePlage(page, libelle, attendu) {
  await page
    .waitForFunction(
      ([l, a]) => document.querySelector(`nav[aria-label="${l}"] p`)?.textContent?.replace(/\s/g, " ").trim() === a,
      [libelle, attendu.replace(/\s/g, " ")],
      { timeout: 20000 }
    )
    .catch(() => {});
  return normaliser(await plage(page, libelle).textContent());
}

const nomsAffiches = async (page) =>
  page.locator("table tbody tr").evaluateAll((lignes) => lignes.map((l) => l.querySelector("td")?.textContent?.trim() + " " + l.querySelectorAll("td")[1]?.textContent?.trim()));

// ══ Données de référence (API paginée, mêmes règles que la page) ═════════════
const admin = await session(COMPTES.admin);
const total = (await getJson(admin, "/api/etudiants?page=1")).corps.total;
const nbPages = Math.ceil(total / 20);
console.log(`   ${total} élèves visibles par l'admin, ${nbPages} pages de 20`);
if (total <= 20) rapport.ignorer("Navigation entre pages des élèves", "moins de 21 élèves dans la base de dev");

// ══ ADMIN — liste des élèves, 1280 px ═════════════════════════════════════════
const ETUDIANTS = "Pages des étudiants";
await ouvrir(admin, "/admin/etudiants", `nav[aria-label="${ETUDIANTS}"]`);
check("Élèves : « 1–20 sur N » et 20 lignes", normaliser(await plage(admin, ETUDIANTS).textContent()) === libellePlage(1, 20, total) &&
  (await admin.locator("table tbody tr").count()) === Math.min(20, total), normaliser(await plage(admin, ETUDIANTS).textContent()));
check("Élèves : le total affiché est celui de l'API", nombre(await admin.locator('[role="status"]').first().textContent()) === total);
check("Élèves, 1280 px : numéros de page visibles, page 1 marquée, version compacte masquée",
  (await nav(admin, ETUDIANTS).locator("ul").isVisible()) &&
  normaliser(await nav(admin, ETUDIANTS).locator('[aria-current="page"]').textContent()) === "Page 1" &&
  !(await nav(admin, ETUDIANTS).getByText(/^Page \d+ sur \d+$/).isVisible()));
check("Élèves, page 1 : « Précédent » désactivé", (await nav(admin, ETUDIANTS).locator('[aria-disabled="true"]', { hasText: "Précédent" }).count()) === 1);
await admin.screenshot({ path: path.join(CAPTURES, "eleves-1280.png"), fullPage: true });

if (total > 20) {
  const page1 = await nomsAffiches(admin);
  await nav(admin, ETUDIANTS).getByRole("link", { name: /Suivant/ }).click();
  await admin.waitForURL(/[?&]page=2\b/);
  const p2 = await attendrePlage(admin, ETUDIANTS, libellePlage(2, 20, total));
  const page2 = await nomsAffiches(admin);
  check("Suivant → page 2 dans l'URL, « 21–40 sur N »", p2 === libellePlage(2, 20, total), `${p2} — ${new URL(admin.url()).search}`);
  check("Page 2 : aucun élève de la page 1 (tri stable)", page2.length > 0 && page2.every((n) => !page1.includes(n)));

  await nav(admin, ETUDIANTS).getByRole("link", { name: `Page ${nbPages}`, exact: true }).click();
  await admin.waitForURL(new RegExp(`[?&]page=${nbPages}\\b`));
  const pDerniere = await attendrePlage(admin, ETUDIANTS, libellePlage(nbPages, 20, total));
  check(`Clic sur le numéro ${nbPages} → dernière page, « Suivant » désactivé`,
    pDerniere === libellePlage(nbPages, 20, total) &&
    (await nav(admin, ETUDIANTS).locator('[aria-disabled="true"]', { hasText: "Suivant" }).count()) === 1, pDerniere);

  await nav(admin, ETUDIANTS).getByLabel("Par page").selectOption("50");
  await admin.waitForURL(/[?&]taille=50\b/);
  const p50 = await attendrePlage(admin, ETUDIANTS, libellePlage(1, 50, total));
  check("Taille 50 → retour à la page 1, taille gardée dans l'URL",
    p50 === libellePlage(1, 50, total) && !params(admin).has("page") && (await admin.locator("table tbody tr").count()) === Math.min(50, total), `${p50} — ${new URL(admin.url()).search}`);

  // Page 2 en taille 50, puis changement de filtre : retour page 1, taille conservée
  await ouvrir(admin, "/admin/etudiants?taille=50&page=2", `nav[aria-label="${ETUDIANTS}"]`);
  await admin.locator("#filter-niveau").selectOption("Seconde C");
  await admin.waitForURL(/niveau=Seconde/);
  const totalNiveau = (await getJson(admin, "/api/etudiants?page=1&niveau=Seconde+C")).corps.total;
  const pNiveau = await attendrePlage(admin, ETUDIANTS, libellePlage(1, 50, totalNiveau));
  check("Changement de filtre depuis la page 2 → page 1, taille 50 et filtre dans l'URL",
    !params(admin).has("page") && params(admin).get("taille") === "50" && params(admin).get("niveau") === "Seconde C" && pNiveau === libellePlage(1, 50, totalNiveau),
    `${pNiveau} — ${new URL(admin.url()).search}`);
}

await ouvrir(admin, "/admin/etudiants?page=999", `nav[aria-label="${ETUDIANTS}"]`);
await admin.waitForURL((u) => u.searchParams.get("page") !== "999", { timeout: 15000 }).catch(() => {});
check("page=999 → ramenée à la dernière page, sans erreur",
  params(admin).get("page") === (nbPages > 1 ? String(nbPages) : null) &&
  normaliser(await plage(admin, ETUDIANTS).textContent()) === libellePlage(Math.max(1, nbPages), 20, total) &&
  (await admin.locator("main h1").textContent()).includes("Liste des étudiants"), new URL(admin.url()).search || "(page 1)");
await ouvrir(admin, "/admin/etudiants?page=-1&niveau=Seconde+C", `nav[aria-label="${ETUDIANTS}"]`);
await admin.waitForURL((u) => !u.searchParams.has("page"), { timeout: 15000 }).catch(() => {});
check("page=-1 → page 1, filtres conservés", !params(admin).has("page") && params(admin).get("niveau") === "Seconde C", new URL(admin.url()).search);

// ══ PÉRIMÈTRE : le total ne révèle pas les autres établissements ═════════════
const ens = await session(COMPTES.enseignant);
const refEns = (await getJson(ens, "/api/etudiants?page=1")).corps;
const etabEns = refEns.elements[0].etablissement;
const autre = (await getJson(admin, "/api/etablissements")).corps.find((e) => e.id !== etabEns.id);
const totalEtabAdmin = (await getJson(admin, `/api/etudiants?page=1&etablissement=${etabEns.id}`)).corps.total;
check("Enseignant : son total = le nombre d'élèves de son établissement vu par l'admin",
  refEns.total === totalEtabAdmin && refEns.total < total, `${refEns.total} / ${totalEtabAdmin} (admin : ${total} au total)`);

await ouvrir(ens, `/enseignant?etablissement=${autre.id}`, `nav[aria-label="${ETUDIANTS}"]`);
const etabsAffiches = await ens.locator("table tbody tr td:nth-child(3)").allTextContents();
check("Enseignant qui force ?etablissement= d'un autre : même total, uniquement ses élèves",
  normaliser(await plage(ens, ETUDIANTS).textContent()) === libellePlage(1, 20, refEns.total) && etabsAffiches.every((t) => t.trim() === etabEns.nom),
  normaliser(await plage(ens, ETUDIANTS).textContent()));
const pagesEns = Math.max(1, Math.ceil(refEns.total / 20));
await ouvrir(ens, "/enseignant?page=999", `nav[aria-label="${ETUDIANTS}"]`);
await ens.waitForURL((u) => u.searchParams.get("page") !== "999", { timeout: 15000 }).catch(() => {});
check("Enseignant, page=999 → dernière page de son établissement",
  params(ens).get("page") === (pagesEns > 1 ? String(pagesEns) : null), `${new URL(ens.url()).search || "(page 1)"}, ${pagesEns} page(s)`);

const ABSENCES = "Pages des absences";
const absEns = (await getJson(ens, "/api/absences?page=1")).corps;
await ouvrir(ens, "/enseignant/absences", `nav[aria-label="${ABSENCES}"]`);
check("Enseignant, absences : total de son établissement uniquement",
  normaliser(await plage(ens, ABSENCES).textContent()) === libellePlage(1, 20, absEns.total) &&
  (await ens.locator("table tbody tr td:nth-child(3)").allTextContents()).every((t) => t.trim() === etabEns.nom),
  normaliser(await plage(ens, ABSENCES).textContent()));
await ens.context().close();

if (COMPTES.directeur) {
  const dir = await session(COMPTES.directeur);
  const refDir = (await getJson(dir, "/api/etudiants?page=1")).corps;
  await ouvrir(dir, "/enseignant", `nav[aria-label="${ETUDIANTS}"]`);
  check("Directeur : liste paginée de son seul établissement",
    normaliser(await plage(dir, ETUDIANTS).textContent()) === libellePlage(1, 20, refDir.total) && refDir.total < total,
    normaliser(await plage(dir, ETUDIANTS).textContent()));
  const absDir = (await getJson(dir, "/api/absences?page=1")).corps;
  await ouvrir(dir, "/directeur/absences", `nav[aria-label="${ABSENCES}"]`);
  check("Directeur : page Absences de son établissement", normaliser(await plage(dir, ABSENCES).textContent()) === libellePlage(1, 20, absDir.total),
    normaliser(await plage(dir, ABSENCES).textContent()));
  await dir.context().close();
} else {
  rapport.ignorer("Directeur : périmètre de la pagination", "E2E_DIRECTEUR_EMAIL et E2E_DIRECTEUR_MOT_DE_PASSE non définis");
}

// ══ AUTRES LISTES (admin) ════════════════════════════════════════════════════
const LISTES = [
  { chemin: "/admin/alertes?statut=toutes", libelle: "Pages des alertes", api: "/api/alertes?statut=toutes&page=1" },
  { chemin: "/admin/absences", libelle: ABSENCES, api: "/api/absences?page=1" },
  { chemin: "/admin/historique", libelle: "Pages de l'historique", api: "/api/admin/historique?page=1" },
  { chemin: "/admin/utilisateurs", libelle: "Pages des comptes", api: "/api/admin/utilisateurs?page=1" },
];
for (const liste of LISTES) {
  const ref = (await getJson(admin, liste.api)).corps;
  await ouvrir(admin, liste.chemin, `nav[aria-label="${liste.libelle}"]`);
  const lue = normaliser(await plage(admin, liste.libelle).textContent());
  check(`${liste.chemin} : plage « ${libellePlage(1, 20, ref.total)} »`, lue === libellePlage(1, 20, ref.total), lue);

  await nav(admin, liste.libelle).getByLabel("Par page").selectOption("100");
  await admin.waitForURL(/[?&]taille=100\b/);
  const l100 = await attendrePlage(admin, liste.libelle, libellePlage(1, 100, ref.total));
  check(`${liste.chemin} : taille 100 gardée dans l'URL avec les filtres`,
    l100 === libellePlage(1, 100, ref.total) && [...new URL(BASE + liste.chemin).searchParams].every(([k, v]) => params(admin).get(k) === v),
    new URL(admin.url()).search);

  const sep = liste.chemin.includes("?") ? "&" : "?";
  await ouvrir(admin, `${liste.chemin}${sep}page=999`, `nav[aria-label="${liste.libelle}"]`);
  await admin.waitForURL((u) => u.searchParams.get("page") !== "999", { timeout: 15000 }).catch(() => {});
  const derniere = Math.max(1, Math.ceil(ref.total / 20));
  check(`${liste.chemin} : page=999 → page ${derniere}, sans erreur`,
    params(admin).get("page") === (derniere > 1 ? String(derniere) : null) && (await admin.locator("main h1").count()) === 1, new URL(admin.url()).search);
}

// Filtre des absences combiné à la taille : retour à la page 1, taille gardée
await ouvrir(admin, "/admin/absences?taille=50", `nav[aria-label="${ABSENCES}"]`);
await admin.getByLabel("Motif").selectOption("injustifiee");
await admin.waitForURL(/motif=injustifiee/);
const refInj = (await getJson(admin, "/api/absences?page=1&motif=injustifiee")).corps;
const lInj = await attendrePlage(admin, ABSENCES, libellePlage(1, 50, refInj.total));
check("Absences : filtre motif + taille 50 → total filtré, taille conservée",
  lInj === libellePlage(1, 50, refInj.total) && params(admin).get("taille") === "50", `${lInj} — ${new URL(admin.url()).search}`);
await admin.context().close();

// ══ AFFICHAGE MOBILE, 375 px ══════════════════════════════════════════════════
const mobile = await session(COMPTES.admin, { largeur: 375, hauteur: 812 });
const pageMobile = total > 20 ? 2 : 1;
await ouvrir(mobile, `/admin/etudiants${pageMobile > 1 ? `?page=${pageMobile}` : ""}`, `nav[aria-label="${ETUDIANTS}"]`);
const navMobile = nav(mobile, ETUDIANTS);
await navMobile.scrollIntoViewIfNeeded();
const boite = await navMobile.boundingBox();
const largeurPage = await mobile.evaluate(() => document.documentElement.scrollWidth);
check("375 px : pas de défilement horizontal de la page", largeurPage <= 375, `${largeurPage} px`);
check("375 px : la pagination tient dans l'écran", boite && boite.x >= 0 && boite.x + boite.width <= 375, boite ? `${Math.round(boite.x)}–${Math.round(boite.x + boite.width)} px` : "");
if (total > 20) {
  check("375 px : version compacte « Page 2 sur N », numéros masqués",
    (await navMobile.getByText(`Page ${pageMobile} sur ${nbPages}`).isVisible()) && !(await navMobile.locator("ul").isVisible()));
  const [precedent, suivant] = await Promise.all([
    navMobile.getByRole("link", { name: /Précédent/ }).boundingBox(),
    navMobile.getByRole("link", { name: /Suivant/ }).boundingBox(),
  ]);
  check("375 px : Précédent et Suivant visibles sur une même ligne, cibles ≥ 40 px de haut",
    precedent && suivant && Math.abs(precedent.y - suivant.y) < 2 && precedent.height >= 40 && suivant.x + suivant.width <= 375);
}
await navMobile.screenshot({ path: path.join(CAPTURES, "pagination-375.png") });
await mobile.screenshot({ path: path.join(CAPTURES, "eleves-375.png"), fullPage: true });
await ouvrir(mobile, "/admin/absences", `nav[aria-label="${ABSENCES}"]`);
check("375 px, absences : pas de défilement horizontal de la page", (await mobile.evaluate(() => document.documentElement.scrollWidth)) <= 375);
await mobile.screenshot({ path: path.join(CAPTURES, "absences-375.png"), fullPage: true });
await mobile.context().close();

const large = await session(COMPTES.admin);
await ouvrir(large, `/admin/etudiants${total > 20 ? "?page=2" : ""}`, `nav[aria-label="${ETUDIANTS}"]`);
await nav(large, ETUDIANTS).screenshot({ path: path.join(CAPTURES, "pagination-1280.png") });
await ouvrir(large, "/admin/absences", `nav[aria-label="${ABSENCES}"]`);
await large.screenshot({ path: path.join(CAPTURES, "absences-1280.png"), fullPage: true });
await large.context().close();

await navigateur.close();
check("Aucune erreur JS", erreursJs.length === 0, erreursJs.slice(0, 3).join(" ; "));
rapport.terminer();
