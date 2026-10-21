// Responsive : pages principales des quatre rôles (et pages publiques) à toutes les
// largeurs testées (téléphones, tablettes, ordinateurs, téléphone en paysage), plus le
// zoom du navigateur à 200 % et la plus grande taille de texte sur petit téléphone.
// Échoue en cas de défilement horizontal, d'élément qui sort de l'écran, de texte qui
// déborde de son cadre ou, sur écran tactile, de zone à toucher de moins de 44 × 44 px.
// Captures dans e2e/resultats/captures/responsive. Aucune écriture en base.
import path from "node:path";
import { BASE, COMPTES, creerRapport, dossierResultats, lancerNavigateur } from "./commun.mjs";
import { FORMATS, LARGEUR_MAX_TACTILE, ZOOM_200, analyserPage, preferencesAccessibilite } from "./analyse-mise-en-page.mjs";

const rapport = creerRapport("Responsive");
const { check } = rapport;
const CAPTURES = dossierResultats("captures", "responsive");
const navigateur = await lancerNavigateur();

const CONFIGS = [
  ...FORMATS,
  ZOOM_200,
  { ...FORMATS[0], nom: "320-texte-max", taille: "x-large" },
  { ...FORMATS.find((f) => f.largeur === 768), nom: "768-texte-max", taille: "x-large" },
];

const PAGES = {
  public: () => ["/", "/en", "/login", "/en/login"],
  admin: (id) => ["/admin", "/admin/alertes", "/admin/absences", "/admin/etudiants", `/admin/etudiants/${id}`, "/admin/utilisateurs", "/admin/historique", "/admin/import", "/admin/page-introuvable"],
  directeur: (id) => ["/directeur", "/directeur/alertes", `/enseignant/etudiants/${id}`],
  enseignant: (id) => ["/enseignant", "/enseignant/alertes", `/enseignant/etudiants/${id}`, "/profil"],
  etudiant: () => ["/etudiant"],
};

const tactile = (config) => config.largeur <= LARGEUR_MAX_TACTILE && !config.echelle;
const resume = (liste, champ = "element") => liste.slice(0, 2).map((x) => x[champ]).join(" ; ");

async function parcourir(role, config) {
  const compte = role === "public" ? null : COMPTES[role];
  if (role !== "public" && !compte) return [`${role} : compte de test non défini`];
  const contexte = await navigateur.newContext({
    viewport: { width: config.largeur, height: config.hauteur },
    deviceScaleFactor: config.echelle ?? 1,
    isMobile: tactile(config),
    hasTouch: tactile(config),
    serviceWorkers: "block",
  });
  await preferencesAccessibilite(contexte, { taille: config.taille ?? "normal" });
  // Lecture seule : toute requête d'écriture est bloquée, sauf la connexion
  await contexte.route("**/*", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.host.endsWith(".sentry.io")) return route.abort();
    return ["GET", "HEAD", "OPTIONS"].includes(req.method()) || url.pathname.startsWith("/api/auth/") ? route.continue() : route.abort();
  });
  const page = await contexte.newPage();
  if (compte) {
    await page.goto(`${BASE}/login`);
    await page.fill("#email", compte.email);
    await page.fill("#password", compte.motDePasse);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
  }
  const id =
    role === "public" || role === "etudiant"
      ? null
      : await page.evaluate(async () => (await (await fetch("/api/alertes?statut=toutes&page=1")).json()).elements?.[0]?.etudiant?.id);
  const lignes = [];
  for (const chemin of PAGES[role](id)) {
    const libelle = `${role} ${chemin.replace(id ?? "§", "[id]")}`;
    await page.goto(`${BASE}${chemin}`);
    await page.waitForLoadState("networkidle");
    await page.locator("main h1").first().waitFor({ timeout: 30000 }).catch(() => {});
    if (await page.locator("svg.recharts-surface").count()) await page.waitForTimeout(1500); // graphiques animés
    const a = await analyserPage(page, { cibleTactile: tactile(config) ? 44 : 0 });
    await page.screenshot({ path: path.join(CAPTURES, `${config.nom}--${libelle.replace(/[ /[\]]+/g, "_")}.png`), fullPage: true });
    lignes.push({ libelle, a });
  }
  await contexte.close();
  return lignes;
}

for (const config of CONFIGS) {
  const parRole = await Promise.all(Object.keys(PAGES).map((role) => parcourir(role, config)));
  for (const lignes of parRole) {
    for (const ligne of lignes) {
      if (typeof ligne === "string") {
        rapport.ignorer(`[${config.nom}] ${ligne}`, "E2E_DIRECTEUR_EMAIL et E2E_DIRECTEUR_MOT_DE_PASSE non définis");
        continue;
      }
      const { libelle, a } = ligne;
      check(`[${config.nom}] ${libelle} : aucun défilement horizontal`, a.debordementHorizontal === 0, a.debordementHorizontal ? `+${a.debordementHorizontal} px` : "");
      check(`[${config.nom}] ${libelle} : aucun élément hors de l'écran`, a.depassements.length === 0, resume(a.depassements));
      check(`[${config.nom}] ${libelle} : aucun texte qui déborde de son cadre`, a.textesQuiDebordent.length === 0, resume(a.textesQuiDebordent));
      const tableaux = a.tableaux.filter((t) => t.probleme);
      check(`[${config.nom}] ${libelle} : tableaux dans l'écran (défilement interne si besoin)`, tableaux.length === 0, resume(tableaux, "probleme"));
      if (tactile(config)) {
        check(`[${config.nom}] ${libelle} : zones à toucher ≥ 44 × 44 px`, a.ciblesPetites.length === 0, a.ciblesPetites.slice(0, 2).map((c) => `${c.element} ${c.largeur}×${c.hauteur}`).join(" ; "));
      }
    }
  }
}

// ── Au doigt : menu mobile, cloche et fenêtre de confirmation (annulée) ─────
for (const config of [FORMATS[0], FORMATS.find((f) => f.largeur === 768), FORMATS.at(-1)]) {
  const vw = config.largeur, vh = config.hauteur;
  const contexte = await navigateur.newContext({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await contexte.route("**/*", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.host.endsWith(".sentry.io")) return route.abort();
    return ["GET", "HEAD", "OPTIONS"].includes(req.method()) || url.pathname.startsWith("/api/auth/") ? route.continue() : route.abort();
  });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", COMPTES.admin.email);
  await page.fill("#password", COMPTES.admin.motDePasse);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname === "/admin", { timeout: 60000 });
  await page.goto(`${BASE}/admin/alertes`);
  await page.waitForLoadState("networkidle");

  const boutonMenu = page.locator('button[aria-controls="mobile-nav-menu"]');
  if (await boutonMenu.isVisible()) {
    const b = await boutonMenu.boundingBox();
    check(`[${config.nom}] menu mobile : bouton ≥ 44 × 44 px`, b.width >= 43.5 && b.height >= 43.5, `${Math.round(b.width)}×${Math.round(b.height)}`);
    await boutonMenu.click();
    await page.locator("#mobile-nav-menu").waitFor();
    await page.keyboard.press("Escape");
    check(`[${config.nom}] menu mobile : Échap ferme le menu`, !(await page.locator("#mobile-nav-menu").isVisible()));
    check(`[${config.nom}] menu mobile : le focus revient au bouton`, (await page.evaluate(() => document.activeElement?.getAttribute("aria-controls"))) === "mobile-nav-menu");
  }

  await page.getByRole("button", { name: /^Notifications/ }).click();
  const panneau = page.locator('[aria-label="Dernières alertes"]');
  await panneau.waitFor();
  const bp = await panneau.boundingBox();
  check(`[${config.nom}] cloche : panneau dans la largeur de l'écran`, bp.x >= 0 && bp.x + bp.width <= vw + 1, `${Math.round(bp.x)} → ${Math.round(bp.x + bp.width)} / ${vw}`);
  await page.keyboard.press("Escape");
  check(`[${config.nom}] cloche : Échap ferme le panneau`, !(await panneau.isVisible()));

  const traiter = page.getByRole("button", { name: /Marquer comme traitée/ }).first();
  if (await traiter.count()) {
    await traiter.scrollIntoViewIfNeeded();
    await traiter.click();
    const fenetre = page.locator(".swal2-popup");
    await fenetre.waitFor();
    await page.waitForTimeout(400);
    const bf = await fenetre.boundingBox();
    check(`[${config.nom}] confirmation : fenêtre dans l'écran`, bf.x >= 0 && bf.x + bf.width <= vw + 1 && bf.y >= 0 && bf.y + bf.height <= vh + 1, `${Math.round(bf.width)}×${Math.round(bf.height)}`);
    const boutons = await Promise.all([".swal2-confirm", ".swal2-cancel"].map((s) => page.locator(s).boundingBox()));
    check(`[${config.nom}] confirmation : boutons ≥ 44 px de haut`, boutons.every((x) => x.height >= 43.5), boutons.map((x) => Math.round(x.height)).join(" / "));
    await page.locator(".swal2-cancel").click();
  }
  await contexte.close();
}

await navigateur.close();
rapport.terminer();
