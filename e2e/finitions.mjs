// Finitions visuelles : page 404 (rôles, fiches hors périmètre), notes par
// année scolaire puis par trimestre en accordéon (souris, clavier, ARIA), squelettes de chargement
// (forme, animation réduite, contraste élevé) et stabilité de la mise en page
// (CLS mesuré dans le navigateur) à 375 px et 1280 px ; tableaux de bord : ligne « Mis à jour »,
// actualisation (bouton, 5 minutes, retour sur l'onglet), chiffres clés sans doublon, en-tête.
// Captures dans e2e/resultats/captures/finitions. Aucune écriture en base.
import path from "node:path";
import { AUJOURDHUI, BASE, COMPTES, connecter, creerRapport, dossierResultats, getJson, lancerNavigateur, ouvrir } from "./commun.mjs";

const rapport = creerRapport("Finitions visuelles");
const { check } = rapport;
const CAPTURES = dossierResultats("captures", "finitions");
const navigateur = await lancerNavigateur();
const erreursJs = [];
const MOBILE = { largeur: 375, hauteur: 812 };

async function session(compte, options) {
  const page = await connecter(navigateur, compte, options);
  page.on("pageerror", (e) => erreursJs.push(`${compte.email} : ${e.message}`));
  return page;
}

const capture = (page, nom) => page.screenshot({ path: path.join(CAPTURES, `${nom}.png`), fullPage: true });
const normaliser = (t) => (t ?? "").replace(/\s+/g, " ").trim();
const largeurPage = (page) => page.evaluate(() => document.documentElement.scrollWidth);
const moyenne = (notes) => notes.reduce((t, n) => t + n.valeur, 0) / notes.length;
const TRIMESTRES = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];

// Trimestre en cours au Bénin (même règle que src/lib/annee-scolaire.ts) : le seul ouvert par défaut
const [anJour, moisJour] = AUJOURDHUI.split("-").map(Number);
const debutAnnee = moisJour >= 9 ? anJour : anJour - 1;
const ANNEE_EN_COURS = `${debutAnnee}-${debutAnnee + 1}`;
const TRIMESTRE_EN_COURS = moisJour >= 9 ? "Trimestre 1" : moisJour <= 3 ? "Trimestre 2" : "Trimestre 3";

/** Années affichées : celles des notes et l'année en cours, la plus récente d'abord. */
const anneesAttendues = (notes) => [...new Set([ANNEE_EN_COURS, ...notes.map((n) => n.anneeScolaire)])].sort().reverse();

// ══ 1. PAGE 404 ══════════════════════════════════════════════════════════════

/** Contenu de la page 404 affichée par `chemin`. */
async function page404(page, chemin) {
  const reponse = await page.goto(`${BASE}${chemin}`);
  await page.waitForLoadState("networkidle");
  await page.locator("main h1").first().waitFor({ timeout: 30000 });
  const main = page.locator("main").last();
  const bouton = main.getByRole("link", { name: /Retour/ });
  return {
    statut: reponse?.status(),
    titre: normaliser(await page.locator("main h1").first().textContent()),
    texte: normaliser(await main.textContent()),
    armoiries: await main.getByRole("img", { name: "Armoiries du Bénin" }).isVisible(),
    bouton: { href: await bouton.getAttribute("href"), libelle: normaliser(await bouton.textContent()) },
  };
}

const ACCUEILS = { admin: "/admin", directeur: "/directeur", enseignant: "/enseignant", etudiant: "/etudiant" };
for (const [role, accueil] of Object.entries(ACCUEILS)) {
  const compte = COMPTES[role];
  if (!compte) {
    rapport.ignorer(`404 ${role}`, "E2E_DIRECTEUR_EMAIL et E2E_DIRECTEUR_MOT_DE_PASSE non définis");
    continue;
  }
  const page = await session(compte);
  const p = await page404(page, `${accueil}/page-qui-n-existe-pas`);
  check(`404 ${role} : « Page introuvable », armoiries, statut 404, bouton vers ${accueil}`,
    p.titre === "Page introuvable" && p.armoiries && p.statut === 404 && p.bouton.href === accueil && p.bouton.libelle === "Retour à mon espace",
    `${p.statut} « ${p.titre} » → ${p.bouton.href}`);
  await page.locator("main").last().getByRole("link", { name: /Retour/ }).click();
  await page.waitForURL((u) => u.pathname === accueil, { timeout: 30000 }).catch(() => {});
  check(`404 ${role} : le bouton ramène à l'accueil de l'espace`, new URL(page.url()).pathname === accueil, new URL(page.url()).pathname);
  await page.context().close();
}

const anonyme = await navigateur.newContext();
const pAnonyme = await anonyme.newPage();
await pAnonyme.goto(`${BASE}/page-qui-n-existe-pas`);
check("Non connecté : une adresse inconnue renvoie vers la connexion (proxy)", new URL(pAnonyme.url()).pathname === "/login");
rapport.ignorer("404 non connecté, bouton vers /", "le proxy redirige vers /login avant la page 404 ; couvert par les tests unitaires");
await anonyme.close();

// Fiche hors périmètre et fiche inexistante : exactement la même page
const admin = await session(COMPTES.admin);
const ens = await session(COMPTES.enseignant);
const etabEns = (await lireOk(ens, "/api/etudiants?page=1")).elements[0].etablissement;
const autreEtab = (await lireOk(admin, "/api/etablissements")).find((e) => e.id !== etabEns.id);
const eleveAutre = (await lireOk(admin, `/api/etudiants?page=1&etablissement=${autreEtab.id}`)).elements[0];
const horsPerimetre = await page404(ens, `/enseignant/etudiants/${eleveAutre.id}`);
const inexistante = await page404(ens, "/enseignant/etudiants/cl-inexistant-000000000000");
check("Enseignant, fiche d'un autre établissement : page 404 sans le nom de l'élève",
  horsPerimetre.titre === "Page introuvable" && !horsPerimetre.texte.includes(eleveAutre.nom) && !horsPerimetre.texte.includes(eleveAutre.prenom));
check("Fiche hors périmètre et fiche inexistante : même statut, même texte, même bouton",
  horsPerimetre.statut === inexistante.statut && horsPerimetre.texte === inexistante.texte && horsPerimetre.bouton.href === inexistante.bouton.href,
  `statuts ${horsPerimetre.statut} / ${inexistante.statut}`);
const adminInexistante = await page404(admin, "/admin/etudiants/cl-inexistant-000000000000");
check("Admin, fiche inexistante : même page 404, bouton vers /admin", adminInexistante.titre === "Page introuvable" && adminInexistante.bouton.href === "/admin");

if (COMPTES.directeur) {
  const dir = await session(COMPTES.directeur);
  const etabDir = (await lireOk(dir, "/api/etudiants?page=1")).elements[0]?.etablissement;
  const autreDir = (await lireOk(admin, "/api/etablissements")).find((e) => e.id !== etabDir?.id);
  const eleveHorsDir = (await lireOk(admin, `/api/etudiants?page=1&etablissement=${autreDir.id}`)).elements[0];
  const pDir = await page404(dir, `/enseignant/etudiants/${eleveHorsDir.id}`);
  check("Directeur, fiche d'un autre établissement : page 404, bouton vers /directeur",
    pDir.titre === "Page introuvable" && pDir.bouton.href === "/directeur" && !pDir.texte.includes(eleveHorsDir.nom));
  await dir.context().close();
}

const etu = await session(COMPTES.etudiant);
const pEtu = await page404(etu, `/admin/etudiants/${eleveAutre.id}`);
check("Étudiant qui force une URL de fiche : page 404, bouton vers /etudiant", pEtu.titre === "Page introuvable" && pEtu.bouton.href === "/etudiant");
await etu.context().close();

const mobile404 = await session(COMPTES.enseignant, MOBILE);
await page404(mobile404, `/enseignant/etudiants/${eleveAutre.id}`);
const boite404 = await mobile404.locator("main").last().getByRole("link", { name: /Retour/ }).boundingBox();
check("404 à 375 px : pas de défilement horizontal, bouton ≥ 44 px dans l'écran",
  (await largeurPage(mobile404)) <= 375 && boite404.height >= 44 && boite404.x >= 0 && boite404.x + boite404.width <= 375);
await capture(mobile404, "404-375");
await mobile404.context().close();
await page404(admin, "/admin/page-qui-n-existe-pas");
await capture(admin, "404-1280");

// ══ 2. NOTES PAR TRIMESTRE EN ACCORDÉON ══════════════════════════════════════

const entetes = (page) => page.locator("[data-entete-trimestre]");

/** État lu dans le DOM : pour chaque en-tête, son libellé, aria-expanded et la visibilité de son panneau. */
const etatAccordeon = (page) =>
  entetes(page).evaluateAll((boutons) =>
    boutons.map((b) => {
      const panneau = document.getElementById(b.getAttribute("aria-controls"));
      return {
        texte: b.textContent.replace(/\s+/g, " ").trim(),
        ouvert: b.getAttribute("aria-expanded") === "true",
        panneauExiste: !!panneau,
        panneauVisible: !!panneau && !panneau.hidden && panneau.offsetHeight > 0,
        cle: b.getAttribute("data-entete-trimestre"),
        etiquette: panneau?.getAttribute("aria-labelledby") === b.id,
        type: b.getAttribute("type"),
        dansH4: b.parentElement.tagName === "H4",
        annee: b.closest("[data-annee]")?.getAttribute("data-annee"),
      };
    })
  );

async function verifierAccordeon(page, nom, notes) {
  const etat = await etatAccordeon(page);
  const annees = anneesAttendues(notes);
  // Blocs d'année de l'accordéon des notes (ceux des absences n'ont pas d'en-tête de trimestre)
  const titresAnnees = await page.evaluate(() =>
    [...document.querySelectorAll("[data-annee]")].filter((b) => b.querySelector("[data-entete-trimestre]")).map((b) => b.querySelector("h3").textContent)
  );
  check(`${nom} : une année par bloc (h3), la plus récente d'abord — ${annees.join(", ")}`,
    titresAnnees.map((t) => t.replace(/\s*\(en cours\)/, "").replace(/\s+/g, " ").trim()).join() === annees.map((a) => `Année scolaire ${a}`).join(),
    titresAnnees.join(" | "));
  check(`${nom} : 3 trimestres par année, boutons dans un h4, aria-controls → panneau étiqueté`,
    etat.length === 3 * annees.length && etat.every((e) => e.type === "button" && e.dansH4 && e.panneauExiste && e.etiquette) &&
    etat.every((e, i) => e.annee === annees[Math.floor(i / 3)] && e.cle === `${e.annee}::${TRIMESTRES[i % 3]}`));
  check(`${nom} : aria-expanded cohérent avec le panneau affiché`, etat.every((e) => e.ouvert === e.panneauVisible));

  const attendu = `${ANNEE_EN_COURS}::${TRIMESTRE_EN_COURS}`;
  check(`${nom} : seul le trimestre en cours (${TRIMESTRE_EN_COURS} ${ANNEE_EN_COURS}) est ouvert`,
    etat.filter((e) => e.ouvert).length === 1 && etat.find((e) => e.ouvert)?.cle === attendu, etat.filter((e) => e.ouvert).map((e) => e.cle).join(" | "));
  const moyennesOk = etat.every((e) => {
    const duT = notes.filter((n) => `${n.anneeScolaire}::${n.periode}` === e.cle);
    return duT.length === 0 ? e.texte.includes("Pas de moyenne") : e.texte.includes(`${moyenne(duT).toFixed(1).replace(".", ",")}/20`) && e.texte.includes(`${duT.length} note`);
  });
  check(`${nom} : chaque en-tête affiche la moyenne et le nombre de notes de son trimestre et de son année, même replié`, moyennesOk);

  // Souris : ouvrir puis replier le premier trimestre
  const premier = entetes(page).first();
  const avant = (await etatAccordeon(page))[0].ouvert;
  await premier.click();
  const apresClic = (await etatAccordeon(page))[0];
  await premier.click();
  check(`${nom} : un clic ouvre ou replie le trimestre`, apresClic.ouvert === !avant && apresClic.panneauVisible === !avant && (await etatAccordeon(page))[0].ouvert === avant);

  // Clavier : Entrée, Espace, flèches, Début, Fin
  await premier.focus();
  await page.keyboard.press("Enter");
  const apresEntree = (await etatAccordeon(page))[0].ouvert;
  await page.keyboard.press("Space");
  const apresEspace = (await etatAccordeon(page))[0].ouvert;
  const focusIndex = () => page.evaluate(() => [...document.querySelectorAll("[data-entete-trimestre]")].indexOf(document.activeElement));
  await page.keyboard.press("ArrowDown");
  const bas = await focusIndex();
  await page.keyboard.press("End");
  const fin = await focusIndex();
  await page.keyboard.press("ArrowDown");
  const boucle = await focusIndex();
  await page.keyboard.press("Home");
  const debut = await focusIndex();
  check(`${nom} : clavier — Entrée et Espace basculent, flèches/Début/Fin déplacent le focus (toutes années)`,
    apresEntree === !avant && apresEspace === avant && bas === 1 && fin === etat.length - 1 && boucle === 0 && debut === 0, `${bas},${fin},${boucle},${debut}`);
}

/** GET JSON qui doit réussir : sinon, erreur explicite (statut et message de l'API). */
async function lireOk(page, url) {
  const { status, corps } = await getJson(page, url);
  if (status !== 200) throw new Error(`GET ${url} → ${status} ${JSON.stringify(corps)}`);
  return corps;
}

// Fiche admin : comparée aux données de l'API
const elevesEns = (await lireOk(admin, `/api/etudiants?page=1&etablissement=${etabEns.id}`)).elements;
let eleve = null;
for (const e of elevesEns.slice(0, 10)) {
  const fiche = await lireOk(admin, `/api/etudiants/${e.id}`);
  if (new Set(fiche.notes.map((n) => n.periode)).size >= 2) {
    eleve = fiche;
    break;
  }
}
eleve ??= await lireOk(admin, `/api/etudiants/${elevesEns[0].id}`);
console.log(`   Fiche testée : ${eleve.notes.length} notes, années ${anneesAttendues(eleve.notes).join(", ")}`);

await ouvrir(admin, `/admin/etudiants/${eleve.id}`);
await verifierAccordeon(admin, "Fiche admin", eleve.notes);
await capture(admin, "fiche-admin-1280");

await ouvrir(ens, `/enseignant/etudiants/${eleve.id}`);
await verifierAccordeon(ens, "Fiche enseignant", eleve.notes);
await capture(ens, "fiche-enseignant-1280");

if (COMPTES.directeur) {
  const dir = await session(COMPTES.directeur);
  const eleveDir = (await lireOk(dir, "/api/etudiants?page=1")).elements[0];
  const ficheDir = (await getJson(dir, `/api/etudiants/${eleveDir.id}`)).corps;
  await ouvrir(dir, `/enseignant/etudiants/${eleveDir.id}`);
  await verifierAccordeon(dir, "Fiche directeur", ficheDir.notes);
  await dir.context().close();
}

const etudiant = await session(COMPTES.etudiant);
await ouvrir(etudiant, "/etudiant");
await verifierAccordeon(etudiant, "Espace étudiant", await lireOk(etudiant, "/api/notes"));
await capture(etudiant, "etudiant-1280");
await etudiant.context().close();

// 375 px : en-têtes lisibles, pas de débordement
for (const [compte, chemin, nom] of [
  [COMPTES.etudiant, "/etudiant", "etudiant"],
  [COMPTES.admin, `/admin/etudiants/${eleve.id}`, "fiche-admin"],
  [COMPTES.enseignant, `/enseignant/etudiants/${eleve.id}`, "fiche-enseignant"],
]) {
  const page = await session(compte, MOBILE);
  await ouvrir(page, chemin);
  const boites = await entetes(page).evaluateAll((b) => b.map((x) => x.getBoundingClientRect()).map((r) => ({ x: r.x, droite: r.right, h: r.height })));
  check(`375 px, ${nom} : pas de défilement horizontal, en-têtes dans l'écran et ≥ 44 px`,
    (await largeurPage(page)) <= 375 && boites.every((b) => b.x >= 0 && b.droite <= 375 && b.h >= 44), `${await largeurPage(page)} px`);
  await capture(page, `${nom}-375`);
  await page.context().close();
}

// ══ 3. SQUELETTES DE CHARGEMENT ══════════════════════════════════════════════

/**
 * Attend la fin des préchargements de Next. Le squelette (loading.tsx) arrive
 * avec le préchargement du lien : tant qu'il est en cours, une navigation
 * garde l'ancienne page au lieu d'afficher le squelette. Sur mobile, les liens
 * n'existent qu'une fois le menu ouvert, et Next les précharge un peu après.
 */
async function attendrePrechargements(page) {
  if (!page.prechargements) {
    page.prechargements = new Set();
    const fin = (req) => page.prechargements.delete(req);
    page.on("request", (req) => req.headers()["next-router-prefetch"] && page.prechargements.add(req));
    page.on("requestfinished", fin);
    page.on("requestfailed", fin);
  }
  // Calme pendant 500 ms d'affilée : les préchargements différés ont eu le temps de partir
  for (let calme = 0, essais = 0; calme < 2 && essais < 60; essais++) {
    await page.waitForTimeout(250);
    calme = page.prechargements.size === 0 ? calme + 1 : 0;
  }
}

/**
 * Ralentit les requêtes RSC des navigations (pas des préchargements) pour
 * laisser le temps d'observer le squelette, puis navigue via le lien et capture.
 */
async function observerSquelette(page, lien, nom) {
  await attendrePrechargements(page); // écoute installée avant le survol
  await lien.hover(); // préchargement « d'intention », comme un utilisateur réel
  await attendrePrechargements(page);
  let ralentir = true;
  await page.route("**/*", async (route) => {
    const req = route.request();
    const rsc = req.headers()["rsc"] === "1" || req.url().includes("_rsc=");
    if (ralentir && rsc && !req.headers()["next-router-prefetch"]) await new Promise((r) => setTimeout(r, 2500));
    await route.continue().catch(() => {});
  });
  await lien.click();
  const squelette = page.locator('main[aria-busy="true"]');
  const vu = await squelette.waitFor({ timeout: 5000 }).then(() => true, () => false);
  let infos = null;
  if (vu) {
    infos = await squelette.evaluate((m) => ({
      statut: m.querySelector('[role="status"]')?.textContent ?? "",
      blocs: m.querySelectorAll(".squelette").length,
      blocsCaches: [...m.querySelectorAll(".squelette")].every((b) => b.getAttribute("aria-hidden") === "true"),
      titres: m.querySelectorAll("h1, h2, h3").length,
      animation: getComputedStyle(m.querySelector(".squelette")).animationName,
      fond: getComputedStyle(m.querySelector(".squelette")).backgroundColor,
      spinner: !!m.querySelector(".animate-spin"),
      largeur: document.documentElement.scrollWidth,
    }));
    await capture(page, `squelette-${nom}`);
  }
  ralentir = false;
  await page.locator("main h1").first().waitFor({ timeout: 30000 });
  await page.unroute("**/*");
  return { vu, ...infos };
}

const NAV = {
  admin: "Navigation administration",
  enseignant: "Navigation enseignant",
};
const lienNav = (page, nav, libelle) =>
  page.locator(`nav[aria-label="${nav}"] a`, { hasText: new RegExp(`^\\s*${libelle}(\\s|\\d|$)`) }).filter({ visible: true }).first();

for (const [largeur, options] of [["1280", undefined], ["375", MOBILE]]) {
  const page = await session(COMPTES.admin, options);
  // Sur mobile, la navigation est dans un menu repliable
  const ouvrirMenu = async () => {
    const menu = page.locator(`nav[aria-label="${NAV.admin}"] button[aria-expanded="false"]`).first();
    if (await menu.isVisible().catch(() => false)) await menu.click();
  };
  for (const [libelle, nom] of [["Étudiants", "eleves"], ["Alertes", "alertes"], ["Absences", "absences"], ["Historique", "historique"], ["Utilisateurs", "utilisateurs"], ["Tableau de bord", "admin"]]) {
    await ouvrirMenu();
    const s = await observerSquelette(page, lienNav(page, NAV.admin, libelle), `${nom}-${largeur}`);
    check(`Squelette ${nom} (${largeur} px) : affiché pendant le chargement, annoncé, sans titre ni spinner`,
      s.vu && s.statut.startsWith("Chargement") && s.blocs > 10 && s.blocsCaches && s.titres === 0 && !s.spinner,
      s.vu ? `${s.blocs} blocs, « ${s.statut} »` : "non observé");
    if (largeur === "375" && s.vu) check(`Squelette ${nom} (375 px) : pas de défilement horizontal`, s.largeur <= 375, `${s.largeur} px`);
    if (nom === "eleves" && largeur === "1280" && s.vu) check("Squelette animé par défaut (squelette-pulsation)", s.animation === "squelette-pulsation", s.animation);
  }
  await page.context().close();
}

// Fiche élève et tableau de bord enseignant
const ensSq = await session(COMPTES.enseignant);
await ouvrir(ensSq, "/enseignant/alertes");
const sFiche = await observerSquelette(ensSq, ensSq.locator("main a[href^='/enseignant/etudiants/']").first(), "fiche-1280");
check("Squelette fiche élève : affiché, forme de l'accordéon (3 en-têtes)", sFiche.vu && sFiche.titres === 0 && sFiche.blocs > 10);
const sEns = await observerSquelette(ensSq, lienNav(ensSq, NAV.enseignant, "Étudiants"), "enseignant-1280");
check("Squelette tableau de bord enseignant : affiché", sEns.vu && sEns.titres === 0);
await ensSq.context().close();

// prefers-reduced-motion : pas d'animation
const reduit = await navigateur.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
const pReduit = await reduit.newPage();
await pReduit.goto(`${BASE}/login`);
await pReduit.fill("#email", COMPTES.admin.email);
await pReduit.fill("#password", COMPTES.admin.motDePasse);
await pReduit.click('button[type="submit"]');
await pReduit.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
await pReduit.locator("main h1").first().waitFor();
const sReduit = await observerSquelette(pReduit, lienNav(pReduit, NAV.admin, "Alertes"), "alertes-mouvement-reduit");
check("prefers-reduced-motion : les squelettes ne sont pas animés", sReduit.vu && sReduit.animation === "none", sReduit.animation);

// Contraste élevé : blocs gris sur fond noir
await pReduit.evaluate(() => localStorage.setItem("accessibility-contrast", "high"));
await pReduit.reload();
await pReduit.waitForFunction(() => document.documentElement.dataset.theme === "high-contrast");
const sContraste = await observerSquelette(pReduit, lienNav(pReduit, NAV.admin, "Absences"), "absences-contraste-eleve");
check("Contraste élevé : blocs visibles (gris #8a8a8a sur noir), sans pulsation",
  sContraste.vu && sContraste.fond === "rgb(138, 138, 138)" && sContraste.animation === "none", `${sContraste.fond}, ${sContraste.animation}`);
await pReduit.evaluate(() => localStorage.setItem("accessibility-contrast", "default"));
await reduit.close();

// ══ Accès aux alertes depuis le tableau de bord national ════════════════════
const tdb = await session(COMPTES.admin);
await ouvrir(tdb, "/admin");
const navTdb = (await tdb.locator(`nav[aria-label="${NAV.admin}"] a:visible`).allTextContents()).map((t) => t.trim());
check("Navigation admin : « Tableau de bord », plus de « Dashboard »", navTdb.includes("Tableau de bord") && !navTdb.some((t) => /Dashboard/.test(t)), navTdb.join(", "));
const voirTout = tdb.getByRole("link", { name: "Voir toutes les alertes" });
check("Tableau de bord : bouton « Voir toutes les alertes » vers /admin/alertes, plus de « Filtres avancés » ni de filtre sur place",
  (await voirTout.getAttribute("href")) === "/admin/alertes" &&
  (await tdb.getByText(/Filtres avancés/).count()) === 0 && (await tdb.locator('[aria-label="Filtrer les alertes"]').count()) === 0);
const accesDirects = tdb.locator('nav[aria-label="Accès direct aux alertes"] a');
check("Tableau de bord : trois accès directs (risque élevé, absences, 7 derniers jours)",
  JSON.stringify(await accesDirects.evaluateAll((a) => a.map((x) => x.dataset.raccourci))) === JSON.stringify(["eleve", "absences", "recentes"]));
for (const cle of ["eleve", "absences", "recentes"]) {
  await ouvrir(tdb, "/admin");
  const lien = tdb.locator(`[data-raccourci="${cle}"]`);
  const annonce = Number((await lien.locator("span").first().textContent()).trim());
  // Le nombre et son libellé se lisent comme une phrase : « 13 alertes détectées sur les 7 derniers jours »
  const phrase = (await lien.innerText()).replace(/\s+/g, " ").trim();
  check(`Accès direct « ${cle} » : se lit « ${annonce} alerte(s) … »`, new RegExp(`^${annonce} alertes? `).test(phrase), phrase);
  const href = await lien.getAttribute("href");
  await lien.focus();
  const auClavier = await lien.evaluate((el) => document.activeElement === el);
  await tdb.keyboard.press("Enter");
  await tdb.waitForURL((u) => `${u.pathname}${u.search}` === href, { timeout: 20000 });
  await tdb.locator("main h1", { hasText: /^Alertes$/ }).waitFor();
  const total = Number((await tdb.locator('main p[role="status"]').first().textContent()).match(/\d+/)[0]);
  check(`Accès direct « ${cle} » : atteint au clavier, compteur du tableau de bord = total de la page filtrée`, auClavier && annonce === total, `${annonce} / ${total} — ${href}`);
}
await tdb.context().close();

const tdbMobile = await session(COMPTES.admin, MOBILE);
await ouvrir(tdbMobile, "/admin");
const boitesAcces = await tdbMobile.locator('nav[aria-label="Accès direct aux alertes"] a').evaluateAll((a) => a.map((x) => x.getBoundingClientRect()).map((r) => ({ x: r.x, droite: r.right, y: r.y })));
check("375 px : accès directs empilés et dans l'écran, pas de défilement horizontal",
  boitesAcces.every((b) => b.x >= 0 && b.droite <= 375) && boitesAcces[1].y > boitesAcces[0].y && (await largeurPage(tdbMobile)) <= 375);
await tdbMobile.locator("#alerts-title").scrollIntoViewIfNeeded();
await tdbMobile.screenshot({ path: path.join(CAPTURES, "acces-alertes-375.png") });
// Contraste élevé : bordures et textes blancs sur noir, accès toujours lisibles
await tdbMobile.evaluate(() => localStorage.setItem("accessibility-contrast", "high"));
await tdbMobile.reload();
await tdbMobile.waitForFunction(() => document.documentElement.dataset.theme === "high-contrast");
const styleContraste = await tdbMobile.locator('[data-raccourci="eleve"]').evaluate((el) => {
  const s = getComputedStyle(el);
  return { bordure: s.borderLeftColor, texte: getComputedStyle(el.querySelector("span")).color, fond: s.backgroundColor };
});
check("Contraste élevé : accès directs en blanc sur noir, bordure visible",
  styleContraste.bordure === "rgb(255, 255, 255)" && styleContraste.texte === "rgb(255, 255, 255)" && styleContraste.fond === "rgb(0, 0, 0)", JSON.stringify(styleContraste));
await tdbMobile.evaluate(() => localStorage.setItem("accessibility-contrast", "default"));
await tdbMobile.context().close();
const tdbLarge = await session(COMPTES.admin);
await ouvrir(tdbLarge, "/admin");
await tdbLarge.locator("#alerts-title").scrollIntoViewIfNeeded();
await tdbLarge.screenshot({ path: path.join(CAPTURES, "acces-alertes-1280.png") });
await tdbLarge.context().close();

// ══ Tableaux de bord : ligne « Mis à jour », actualisation, cartes, en-tête ══
const dateDonnees = (page) => page.locator("[data-mise-a-jour] time").getAttribute("datetime");
/** Attend de nouvelles données (instant différent de `avant`), sans rechargement de la page. */
async function nouvellesDonnees(page, avant, delai = 20000) {
  return page.waitForFunction((a) => document.querySelector("[data-mise-a-jour] time")?.getAttribute("datetime") !== a, avant, { timeout: delai })
    .then(() => true, () => false);
}
const masquerOnglet = (page, masque) => page.evaluate((m) => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (m ? "hidden" : "visible") });
  document.dispatchEvent(new Event("visibilitychange"));
}, masque);

for (const [nomLargeur, options] of [["1280", undefined], ["375", MOBILE]]) {
  const p = await session(COMPTES.admin, options);
  await p.clock.install();
  await ouvrir(p, "/admin");
  const ligne = normaliser(await p.locator("[data-mise-a-jour] p").innerText());
  const time = p.locator("[data-mise-a-jour] time");
  check(`${nomLargeur} px, tableau de bord : « Tous les établissements · Mis à jour à 10 h 28 · à l'instant », heure et ancienneté sur une ligne`,
    /^Tous les établissements (· )?Mis à jour à \d{1,2} h \d{2} ?, heure du Bénin · à l'instant$/.test(ligne) &&
    (await p.locator("[data-mise-a-jour] span.whitespace-nowrap").evaluate((el) => el.getClientRects().length === 1)) &&
    (await time.getAttribute("title")) === "Heure du Bénin", ligne);
  const bouton = p.getByRole("button", { name: "Actualiser" });
  const boite = await bouton.boundingBox();
  check(`${nomLargeur} px : bouton « Actualiser » visible, dans l'écran`, (await bouton.isVisible()) && boite.x + boite.width <= (options?.largeur ?? 1280), JSON.stringify(boite));

  // Trois chiffres clés, « Risque élevé » une seule fois (accès direct)
  const cles = (await p.locator('section[aria-label="Chiffres clés"] article > div > p').allTextContents()).map(normaliser);
  check(`${nomLargeur} px : chiffres clés sans doublon du risque élevé`,
    JSON.stringify(cles) === JSON.stringify(["Étudiants suivis", "Établissements", "Alertes actives"]) &&
    (await p.locator('section[aria-label="Chiffres clés"]').getByText(/risque\sélevé/i).count()) === 0 &&
    (await p.locator('nav[aria-label="Accès direct aux alertes"]').getByText(/risque\sélevé/i).count()) === 1, cles.join(", "));
  const boitesCles = await p.locator('section[aria-label="Chiffres clés"] article').evaluateAll((a) => a.map((x) => x.getBoundingClientRect().x));
  const boitesAcces = await p.locator('nav[aria-label="Accès direct aux alertes"] li').evaluateAll((a) => a.map((x) => x.getBoundingClientRect().x));
  if (!options) check("1280 px : chiffres clés et accès directs alignés sur les mêmes trois colonnes",
    boitesCles.length === 3 && boitesCles.every((x, i) => Math.abs(x - boitesAcces[i]) < 1), `${boitesCles} / ${boitesAcces}`);

  // Aucun mot seul sur la dernière ligne d'un accès direct
  const orphelins = await p.locator('nav[aria-label="Accès direct aux alertes"] a span.block').evaluateAll((spans) => spans.filter((span) => {
    const noeud = span.firstChild;
    const texte = noeud?.textContent ?? "";
    const debutDernier = texte.search(/\S+$/);
    if (debutDernier <= 0) return false;
    const range = document.createRange();
    range.setStart(noeud, debutDernier);
    range.setEnd(noeud, texte.length);
    const dernier = range.getClientRects()[0];
    range.setStart(noeud, 0);
    range.setEnd(noeud, debutDernier - 1);
    const rects = [...range.getClientRects()];
    return rects.length > 0 && rects.every((r) => Math.abs(r.top - dernier.top) > 2);
  }).map((s) => s.textContent));
  check(`${nomLargeur} px : pas de mot orphelin dans les accès directs (« jours »)`, orphelins.length === 0, orphelins.join(" | "));

  // En-tête : prénom et nom, initiales des deux
  const profil = (await getJson(p, "/api/profil")).corps;
  const avatar = normaliser(await p.locator('button[aria-label="Menu utilisateur"] div[aria-hidden="true"]').innerText());
  const attendu = `${profil.prenom[0]}${profil.nom[0]}`.toUpperCase();
  const nomEnTete = p.locator('button[aria-label="Menu utilisateur"] p').first();
  check(`${nomLargeur} px, en-tête : initiales « ${attendu} »${options ? "" : ` et « ${profil.prenom} ${profil.nom} »`}`,
    avatar === attendu && (options ? true : normaliser(await nomEnTete.innerText()) === `${profil.prenom} ${profil.nom}`), `${avatar} / ${await nomEnTete.innerText()}`);
  await p.screenshot({ path: path.join(CAPTURES, `tableau-de-bord-${nomLargeur}.png`) });

  if (!options) {
    // Actualisation sans rechargement : marqueur JS et position des sections conservés
    await p.evaluate(() => { window.__pageInitiale = true; });
    const titreAvant = await p.locator("#alerts-title").evaluate((el) => el.getBoundingClientRect().top);
    let avant = await dateDonnees(p);
    await bouton.click();
    const manuelle = await nouvellesDonnees(p, avant);
    await p.locator('[data-mise-a-jour] [role="status"]', { hasText: "Données mises à jour" }).waitFor({ timeout: 5000 }).catch(() => {});
    check("Actualiser : nouvelles données sans recharger la page, annonce aux lecteurs d'écran, mise en page stable",
      manuelle && (await p.evaluate(() => window.__pageInitiale === true)) &&
      /Données mises à jour/.test(await p.locator('[data-mise-a-jour] [role="status"]').textContent()) &&
      Math.abs((await p.locator("#alerts-title").evaluate((el) => el.getBoundingClientRect().top)) - titreAvant) < 1);

    // Toutes les 5 minutes, onglet visible
    avant = await dateDonnees(p);
    await p.clock.fastForward("04:30");
    await p.waitForTimeout(1500);
    const tropTot = (await dateDonnees(p)) !== avant;
    await p.clock.fastForward("00:35");
    check("Actualisation automatique au bout de 5 minutes, pas avant", !tropTot && (await nouvellesDonnees(p, avant)) && (await p.evaluate(() => window.__pageInitiale === true)));

    // Onglet masqué : rien ; retour sur l'onglet : tout de suite
    avant = await dateDonnees(p);
    await masquerOnglet(p, true);
    await p.clock.fastForward("06:00");
    await p.waitForTimeout(1500);
    const pendantMasque = (await dateDonnees(p)) !== avant;
    await masquerOnglet(p, false);
    check("Onglet masqué : pas d'actualisation ; retour sur l'onglet : actualisation immédiate",
      !pendantMasque && (await nouvellesDonnees(p, avant, 10000)) && (await p.evaluate(() => window.__pageInitiale === true)));
  }
  await p.context().close();
}

if (COMPTES.directeur) {
  const dir = await session(COMPTES.directeur);
  await ouvrir(dir, "/directeur");
  const ligneDir = normaliser(await dir.locator("[data-mise-a-jour] p").innerText());
  const avantDir = await dateDonnees(dir);
  await dir.getByRole("button", { name: "Actualiser" }).click();
  check("Directeur : ligne « Mis à jour à … » et bouton Actualiser",
    /^Mis à jour à \d{1,2} h \d{2} ?, heure du Bénin · à l'instant$/.test(ligneDir) && (await nouvellesDonnees(dir, avantDir)), ligneDir);
  await dir.context().close();
} else {
  rapport.ignorer("Directeur : ligne « Mis à jour »", "E2E_DIRECTEUR_EMAIL et E2E_DIRECTEUR_MOT_DE_PASSE non définis");
}

// En-tête des autres rôles : initiales du prénom et du nom
for (const role of ["enseignant", "etudiant"]) {
  const p = await session(COMPTES[role]);
  const profil = (await getJson(p, "/api/profil")).corps;
  const avatar = normaliser(await p.locator('button[aria-label="Menu utilisateur"] div[aria-hidden="true"]').innerText());
  const nomEnTete = normaliser(await p.locator('button[aria-label="Menu utilisateur"] p').first().innerText());
  check(`En-tête ${role} : « ${profil.prenom} ${profil.nom} », initiales « ${avatar} »`,
    avatar === `${profil.prenom[0]}${profil.nom[0]}`.toUpperCase() && nomEnTete === `${profil.prenom} ${profil.nom}`, `${avatar} / ${nomEnTete}`);
  await p.context().close();
}

// Préférences d'accessibilité : le bouton les enregistre, l'hydratation ne les écrase pas
const acces = await session(COMPTES.enseignant);
await ouvrir(acces, "/enseignant");
const theme = () => acces.evaluate(() => document.documentElement.dataset.theme);
await acces.getByRole("button", { name: /Contraste/ }).first().click();
const apresClic = await theme();
await acces.reload();
await acces.locator("main h1").first().waitFor();
await acces.waitForFunction(() => document.documentElement.dataset.theme === "high-contrast", null, { timeout: 5000 }).catch(() => {});
const apresRechargement = await theme();
const iconesCommandes = await acces.evaluate(() =>
  ["Contraste", "Lire"].map((nom) => {
    const bouton = [...document.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(nom) && b.offsetParent);
    const svg = bouton?.querySelector("svg");
    const r = svg?.getBoundingClientRect();
    return { nom, couleur: svg && getComputedStyle(svg).color, decorative: svg?.getAttribute("aria-hidden") === "true", visible: !!r && r.width > 0 && r.height > 0 };
  })
);
check("Contraste élevé : icônes au trait des commandes (contraste, lecture) blanches, visibles, décoratives ; libellés conservés",
  iconesCommandes.every((i) => i.couleur === "rgb(255, 255, 255)" && i.visible && i.decorative) &&
  (await acces.getByRole("button", { name: "Lire" }).count()) >= 1,
  JSON.stringify(iconesCommandes));
const stocke = await acces.evaluate(() => localStorage.getItem("accessibility-contrast"));
await acces.getByRole("button", { name: /Contraste/ }).first().click();
check("Contraste élevé : activé au clic, conservé après rechargement, désactivable",
  apresClic === "high-contrast" && apresRechargement === "high-contrast" && stocke === "high" && (await theme()) === "default",
  `${apresClic} → ${apresRechargement} → ${await theme()}`);
await acces.getByRole("button", { name: "Augmenter la taille du texte" }).first().click();
await acces.reload();
await acces.locator("main h1").first().waitFor();
await acces.waitForFunction(() => document.documentElement.dataset.fontSize === "large", null, { timeout: 5000 }).catch(() => {});
check("Taille du texte : augmentée au clic et conservée après rechargement",
  (await acces.evaluate(() => document.documentElement.dataset.fontSize)) === "large");
await acces.getByRole("button", { name: "Réduire la taille du texte" }).first().click();
await acces.context().close();

// Menu mobile : se referme après une navigation
const menuMobile = await session(COMPTES.admin, MOBILE);
await ouvrir(menuMobile, "/admin");
await menuMobile.locator(`nav[aria-label="${NAV.admin}"] button[aria-expanded="false"]`).click();
await menuMobile.locator("#mobile-nav-menu").waitFor();
await lienNav(menuMobile, NAV.admin, "Absences").click();
await menuMobile.waitForURL("**/admin/absences");
await menuMobile.locator("main h1", { hasText: "Absences" }).waitFor();
check("Menu mobile : refermé après la navigation",
  (await menuMobile.locator("#mobile-nav-menu").count()) === 0 &&
  (await menuMobile.locator(`nav[aria-label="${NAV.admin}"] button[aria-expanded]`).getAttribute("aria-expanded")) === "false");
await menuMobile.context().close();

// ══ 4. STABILITÉ DE LA MISE EN PAGE (CLS) ════════════════════════════════════

/**
 * Observateur des décalages de mise en page, injecté par addInitScript : il
 * s'exécute dans chaque document avant le moindre script ou contenu de la
 * page, et note l'état du document au moment de son installation (« loading »
 * prouve qu'il était là avant le premier rendu). La somme de tous les
 * décalages hors interaction est un majorant du CLS (qui ne garde que la pire
 * fenêtre de 5 s).
 */
function observateurCls() {
  window.__cls = { installe: false, etat: document.readyState, total: 0, decalages: 0, erreur: null };
  try {
    if (!PerformanceObserver.supportedEntryTypes?.includes("layout-shift")) throw new Error("layout-shift non pris en charge");
    new PerformanceObserver((liste) => {
      for (const e of liste.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__cls.total += e.value;
        window.__cls.decalages++;
      }
    }).observe({ type: "layout-shift", buffered: true });
    window.__cls.installe = true;
  } catch (e) {
    window.__cls.erreur = String(e);
  }
}

/** Charge la page (navigation complète) et renvoie la mesure ; null si l'observateur n'était pas installé avant le rendu. */
async function mesurerCls(page, chemin) {
  await page.goto(`${BASE}${chemin}`);
  await page.waitForLoadState("networkidle");
  await page.locator("main h1").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500); // graphiques chargés côté client
  const mesure = await page.evaluate(() => window.__cls ?? null);
  return mesure?.installe && mesure.etat === "loading" ? mesure : null;
}

const PAGES_CLS = [
  [COMPTES.admin, "/admin"],
  [COMPTES.admin, "/admin/etudiants"],
  [COMPTES.admin, "/admin/alertes"],
  [COMPTES.admin, "/admin/absences"],
  [COMPTES.admin, "/admin/historique"],
  [COMPTES.admin, "/admin/utilisateurs"],
  [COMPTES.admin, `/admin/etudiants/${eleve.id}`],
  [COMPTES.enseignant, "/enseignant"],
  [COMPTES.enseignant, `/enseignant/etudiants/${eleve.id}`],
  [COMPTES.etudiant, "/etudiant"],
  ...(COMPTES.directeur ? [[COMPTES.directeur, "/directeur"]] : []),
];
const court = (chemin) => chemin.replace(/[a-z0-9]{20,}/, ":id");
for (const [nomLargeur, options] of [["1280", undefined], ["375", MOBILE]]) {
  const pages = new Map();
  const resultats = [];
  for (const [compte, chemin] of PAGES_CLS) {
    if (!pages.has(compte)) {
      const page = await session(compte, options);
      await page.addInitScript(observateurCls);
      pages.set(compte, page);
    }
    resultats.push([chemin, await mesurerCls(pages.get(compte), chemin)]);
  }

  const absents = resultats.filter(([, m]) => m === null).map(([c]) => court(c));
  check(`CLS ${nomLargeur} px : observateur installé avant le rendu sur les ${resultats.length} pages`, absents.length === 0, absents.join(", "));

  // Témoin : un décalage provoqué sans interaction doit être compté, sinon la mesure ne prouve rien
  const temoin = pages.get(COMPTES.admin);
  const avant = await temoin.evaluate(() => window.__cls.total);
  await temoin.evaluate(() => {
    const bloc = document.createElement("div");
    bloc.style.height = "240px";
    document.querySelector("main").prepend(bloc);
  });
  await temoin.waitForTimeout(500);
  const apres = await temoin.evaluate(() => window.__cls.total);
  check(`CLS ${nomLargeur} px : témoin — un décalage provoqué est bien mesuré`, apres > avant, `${avant.toFixed(3)} → ${apres.toFixed(3)}`);
  for (const p of pages.values()) await p.context().close();

  const mesures = resultats.filter(([, m]) => m !== null);
  if (mesures.length === 0) continue;
  const pire = mesures.reduce((a, b) => (b[1].total > a[1].total ? b : a));
  console.log(`   CLS ${nomLargeur} px : ${mesures.map(([c, m]) => `${court(c)} ${m.total.toFixed(3)} (${m.decalages})`).join(", ")}`);
  check(`CLS < 0,1 sur les pages mesurées à ${nomLargeur} px`, pire[1].total < 0.1, `pire : ${court(pire[0])} ${pire[1].total.toFixed(3)}`);
}

await admin.context().close();
await ens.context().close();
await navigateur.close();
check("Aucune erreur JS", erreursJs.length === 0, erreursJs.slice(0, 3).join(" ; "));
rapport.terminer();
