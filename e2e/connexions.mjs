// Parcours de connexion des 4 rôles : page d'accueil, navigation, service worker, déconnexion.
import { BASE, COMPTES, connecter, creerRapport, lancerNavigateur } from "./commun.mjs";

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

// ── Limitation des tentatives ────────────────────────────────────────────────
// Le compteur est gardé en mémoire par IP (x-forwarded-for) : une IP de
// documentation (RFC 5737) propre à ce test, pour ne bloquer aucun autre scénario.
const ipTest = (n) => `198.51.100.${n}`;
const suffixe = Date.now() % 200;
const essais = await navigateur.newContext({ extraHTTPHeaders: { "x-forwarded-for": ipTest(suffixe) } });
const pageEssais = await essais.newPage();
await pageEssais.goto(`${BASE}/login`);
const messages = [];
for (let i = 1; i <= 6; i++) {
  await pageEssais.fill("#email", COMPTES.admin.email);
  await pageEssais.fill("#password", `mauvais-mot-de-passe-${i}`);
  await pageEssais.click('button[type="submit"]');
  const alerte = pageEssais.locator('[role="alert"]').filter({ hasText: /incorrect|bloqué/ });
  await alerte.first().waitFor({ timeout: 20000 });
  messages.push((await alerte.first().textContent()).replace(/\s+/g, " ").trim());
}
const bloque = messages[5].includes("Accès temporairement bloqué");
rapport.check("Limitation : 5 mauvais mots de passe → « Email ou mot de passe incorrect. »",
  messages.slice(0, 5).every((m) => m.includes("Email ou mot de passe incorrect")), messages.slice(0, 5).map((m) => m.slice(0, 30)).join(" | "));
rapport.check("Limitation : 6ᵉ essai → « Accès temporairement bloqué », bouton désactivé",
  bloque && (await pageEssais.locator('button[type="submit"]').isDisabled()), messages[5].slice(0, 60));
rapport.check("Limitation : toujours sur /login, aucune session ouverte", new URL(pageEssais.url()).pathname === "/login" &&
  !(await essais.cookies()).some((c) => c.name.includes("session-token")));
await essais.close();

// Le blocage vise l'IP, pas le compte : depuis une autre IP, la connexion fonctionne
const autreIp = await navigateur.newContext({ extraHTTPHeaders: { "x-forwarded-for": ipTest(suffixe + 1) } });
const pageAutre = await autreIp.newPage();
await pageAutre.goto(`${BASE}/login`);
await pageAutre.fill("#email", COMPTES.admin.email);
await pageAutre.fill("#password", COMPTES.admin.motDePasse);
await pageAutre.click('button[type="submit"]');
const connecteAutre = await pageAutre.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }).then(() => true, () => false);
rapport.check("Limitation : depuis une autre IP, le même compte se connecte normalement", connecteAutre, new URL(pageAutre.url()).pathname);
await autreIp.close();

await navigateur.close();
rapport.terminer();
