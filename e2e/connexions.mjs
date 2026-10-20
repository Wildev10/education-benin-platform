// Parcours de connexion des 4 rôles : page d'accueil, navigation, service worker, déconnexion.
import { COMPTES, connecter, creerRapport, lancerNavigateur } from "./commun.mjs";

const rapport = creerRapport("Connexions");
const navigateur = await lancerNavigateur();

const ROLES = [
  { role: "admin", accueil: "/admin", titre: "Dashboard Ministère", nav: "Navigation administration", cible: "/admin/alertes" },
  { role: "directeur", accueil: "/directeur", titre: null, nav: "Navigation directeur", cible: "/directeur/alertes" },
  { role: "enseignant", accueil: "/enseignant", titre: "Espace Enseignant", nav: "Navigation enseignant", cible: "/enseignant/alertes" },
  { role: "etudiant", accueil: "/etudiant", titre: "Bonjour", nav: null },
];

for (const r of ROLES) {
  const compte = COMPTES[r.role];
  if (!compte) {
    rapport.ignorer(`${r.role} : parcours de connexion`, "E2E_DIRECTEUR_EMAIL et E2E_DIRECTEUR_MOT_DE_PASSE non définis");
    continue;
  }

  const page = await connecter(navigateur, compte);
  page.on("console", (m) => m.type() === "error" && page.erreursJs.push(m.text()));

  const titre = (await page.locator("main h1").first().textContent())?.trim() ?? "";
  rapport.check(
    `${r.role} : connexion → ${r.accueil}`,
    new URL(page.url()).pathname === r.accueil && (r.titre === null ? titre.length > 0 : titre.includes(r.titre)),
    `« ${titre} »`
  );

  if (r.nav) {
    await page.click(`nav[aria-label="${r.nav}"] a:has-text("Alertes")`);
    await page.waitForURL(`**${r.cible}`);
    // Le titre n'apparaît qu'une fois le squelette de chargement remplacé
    const vu = await page
      .locator("main h1", { hasText: /^Alertes$/ })
      .waitFor({ timeout: 20000 })
      .then(() => true, () => false);
    rapport.check(`${r.role} : navigation vers ${r.cible}`, vu);
  }

  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {});
  rapport.check(`${r.role} : service worker actif`, await page.evaluate(() => !!navigator.serviceWorker.controller));

  await page.click('button[aria-label="Menu utilisateur"]');
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await page.waitForURL("**/login", { timeout: 30000 });
  rapport.check(`${r.role} : déconnexion → /login`, new URL(page.url()).pathname === "/login");
  rapport.check(`${r.role} : aucune erreur JS`, page.erreursJs.length === 0, page.erreursJs.slice(0, 2).join(" ; "));
  await page.context().close();
}

await navigateur.close();
rapport.terminer();
