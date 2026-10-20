// Version anglaise des pages publiques (accueil et connexion) : rendu serveur
// dans la bonne langue, sélecteur FR/EN, cookie, attribut lang, métadonnées
// (hreflang, Open Graph), messages de connexion traduits, voix de lecture,
// et retour au français une fois connecté. 375 px et 1280 px.
// Aucune écriture en base : la demande « mot de passe oublié » est annulée.
import path from "node:path";
import { BASE, COMPTES, creerRapport, dossierResultats, lancerNavigateur } from "./commun.mjs";

const rapport = creerRapport("Langues (FR / EN)");
/** Adresse publique des métadonnées (metadataBase de la mise en page racine) */
const ORIGINE = "https://education-benin-platform.vercel.app";
const { check } = rapport;
const CAPTURES = dossierResultats("captures", "langues");
const navigateur = await lancerNavigateur();
const erreursJs = [];

// IP de documentation (RFC 5737) propre à ce scénario : les mauvais mots de
// passe ne bloquent aucun autre test (le compteur est gardé par IP)
const ip = () => `192.0.2.${(Date.now() % 200) + Math.floor(Math.random() * 50)}`;

/** Doublure de la synthèse vocale : garde la langue de chaque lecture demandée. */
function doublureSyntheseVocale() {
  window.__lectures = [];
  const synthese = {
    speak: (u) => window.__lectures.push(u.lang),
    cancel: () => {},
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  Object.defineProperty(window, "speechSynthesis", { value: synthese, configurable: true });
  window.SpeechSynthesisUtterance = class {
    constructor(texte) {
      this.text = texte;
      this.lang = "";
    }
  };
}

async function contexte({ largeur = 1280, hauteur = 900 } = {}) {
  const ctx = await navigateur.newContext({
    viewport: { width: largeur, height: hauteur },
    extraHTTPHeaders: { "x-forwarded-for": ip() },
    serviceWorkers: "block",
  });
  await ctx.addInitScript(doublureSyntheseVocale);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erreursJs.push(e.message));
  return page;
}

const lang = (page) => page.evaluate(() => document.documentElement.lang);
const chemin = (page) => new URL(page.url()).pathname;
const cookieLangue = async (page) => (await page.context().cookies()).find((c) => c.name === "langue")?.value ?? null;
const meta = (page, selecteur) => page.locator(selecteur).first().getAttribute("content");
const lienAlternatif = (page, hreflang) => page.locator(`link[rel="alternate"][hreflang="${hreflang}"]`).first().getAttribute("href");
const selecteur = (page) => page.locator("[data-selecteur-langue]");
const largeurPage = (page) => page.evaluate(() => document.documentElement.scrollWidth);

/** Texte visible de la page, sans les noms de langues du sélecteur. */
const texteVisible = (page) =>
  page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    // Sans le sélecteur ni les passages volontairement en français (nom du ministère du challenge)
    clone.querySelectorAll('[data-selecteur-langue], [lang="fr"], script, style').forEach((n) => n.remove());
    return clone.innerText.replace(/\s+/g, " ");
  });
const MOTS_FRANCAIS = /\b(Se connecter|Connexion|Mot de passe|Ministère|élèves|établissements|Comment ça marche|Conçu pour tous|Contraste|Lire|Accédez|Problème)\b/;

// ── 1. Rendu serveur : la bonne langue dès le HTML, sans attendre JavaScript ──
for (const [adresse, attendu, titre] of [
  ["/", "fr", "Personne ne voit un décrochage venir"],
  ["/en", "en", "No one sees school dropout coming"],
  ["/login", "fr", "Connexion"],
  ["/en/login", "en", "Sign in"],
]) {
  const html = await (await fetch(`${BASE}${adresse}`, { redirect: "manual" })).text();
  check(`HTML serveur de ${adresse} : <html lang="${attendu}"> et texte « ${titre} » déjà présents (pas de flash)`,
    new RegExp(`<html[^>]*\\blang="${attendu}"`).test(html) && html.includes(titre));
}

// ── 2. Accueil : bascule FR → EN, cookie, métadonnées ────────────────────────
const p = await contexte();
await p.goto(`${BASE}/`);
check("Accueil : français par défaut, lang=fr", (await lang(p)) === "fr" && (await p.locator("h1").textContent()).includes("Personne ne voit"));
const alternatives = {
  fr: await lienAlternatif(p, "fr"),
  en: await lienAlternatif(p, "en"),
  "x-default": await lienAlternatif(p, "x-default"),
  canonique: await p.locator('link[rel="canonical"]').first().getAttribute("href"),
  ogLocale: await meta(p, 'meta[property="og:locale"]'),
};
const sansBarre = (u) => (u ?? "").replace(/\/$/, "");
check("Accueil FR : canonique, hreflang fr / en / x-default, Open Graph fr_FR",
  sansBarre(alternatives.fr) === ORIGINE && sansBarre(alternatives.en) === `${ORIGINE}/en` && sansBarre(alternatives["x-default"]) === ORIGINE &&
  sansBarre(alternatives.canonique) === ORIGINE && alternatives.ogLocale === "fr_FR", JSON.stringify(alternatives));

check("Accueil FR : « République du Bénin » au-dessus de « Plateforme nationale de suivi scolaire », armoiries présentes",
  (await p.locator("header [data-identite]").innerText()).replace(/\s+/g, " ").trim() === "RÉPUBLIQUE DU BÉNIN EDUTECH BÉNIN Plateforme nationale de suivi scolaire" &&
  (await p.locator("header").getByRole("img", { name: "Armoiries du Bénin" }).count()) === 1 &&
  !/Ministère de l.Éducation/.test(await p.locator("body").innerText()));
check("Accueil FR : mention du challenge recopiée exactement (apostrophe typographique)",
  (await p.locator("footer [data-mention-challenge]").innerText()).trim() ===
    "Projet sélectionné dans le cadre du challenge du Ministère de la Transformation Digitale et de l’Innovation");

await selecteur(p).getByRole("link", { name: /EN/ }).click();
await p.waitForURL(`${BASE}/en`);
check("Clic sur EN : /en, lang=en, cookie langue=en", chemin(p) === "/en" && (await lang(p)) === "en" && (await cookieLangue(p)) === "en");
check("Accueil EN : titre, description et Open Graph en anglais",
  (await p.title()) === "EduTech Bénin — National Student Monitoring Platform" &&
  (await meta(p, 'meta[name="description"]')).startsWith("Automatically detect") &&
  (await meta(p, 'meta[property="og:locale"]')) === "en_US" &&
  (await meta(p, 'meta[property="og:title"]')) === "EduTech Bénin — National Student Monitoring Platform");
check("Accueil EN : lien EN marqué comme courant", (await selecteur(p).getByRole("link", { name: /EN/ }).getAttribute("aria-current")) === "true");
const texteAccueil = await texteVisible(p);
check("Accueil EN : aucun texte français visible", !MOTS_FRANCAIS.test(texteAccueil), texteAccueil.match(MOTS_FRANCAIS)?.[0] ?? "");
check("Accueil EN : intitulé neutre « Republic of Benin » / « National student monitoring platform », plus aucun ministère de l'Éducation",
  (await p.locator("header [data-identite]").innerText()).replace(/\s+/g, " ").trim() === "REPUBLIC OF BENIN EDUTECH BÉNIN National student monitoring platform" &&
  !/Ministry of Education|Ministère de l.Éducation/.test(await p.locator("body").innerText()));
const mentionEn = p.locator("footer [data-mention-challenge]");
check("Accueil EN : mention du challenge exacte, nom du ministère gardé en français (lang=fr)",
  (await mentionEn.innerText()).trim() === "Project selected as part of the challenge organized by the Ministère de la Transformation Digitale et de l’Innovation" &&
  (await mentionEn.locator('span[lang="fr"]').innerText()) === "Ministère de la Transformation Digitale et de l’Innovation");
await p.screenshot({ path: path.join(CAPTURES, "accueil-en-1280.png"), fullPage: true });

await p.goto(`${BASE}/`);
check("Cookie conservé : / redirige vers /en", chemin(p) === "/en" && (await lang(p)) === "en");

// ── 3. Connexion en anglais : textes, erreurs, blocage, mot de passe oublié ──
await p.getByRole("link", { name: "Sign in" }).first().click();
await p.waitForURL(`${BASE}/en/login`);
check("Accueil EN → « Sign in » : /en/login, lang=en", chemin(p) === "/en/login" && (await lang(p)) === "en");
check("Connexion EN : titre de page, libellés et hreflang",
  (await p.title()) === "Sign in — EduTech Bénin" &&
  (await p.getByLabel("Password", { exact: true }).count()) === 1 &&
  (await p.getByRole("button", { name: "Show password" }).count()) === 1 &&
  (await lienAlternatif(p, "fr"))?.endsWith("/login") && (await lienAlternatif(p, "en"))?.endsWith("/en/login"));
check("Connexion EN : commandes d'accessibilité en anglais",
  (await p.getByRole("button", { name: "Increase text size" }).count()) === 1 &&
  (await p.getByRole("button", { name: "Read aloud" }).count()) === 1 &&
  (await p.locator('[aria-label="Accessibility options"]').count()) === 1);
await p.getByRole("button", { name: "Read aloud" }).click();
check("Lecture vocale : voix anglaise (en-US) sur la page anglaise", (await p.evaluate(() => window.__lectures.at(-1))) === "en-US");
const texteConnexion = await texteVisible(p);
check("Connexion EN : aucun texte français visible", !MOTS_FRANCAIS.test(texteConnexion), texteConnexion.match(MOTS_FRANCAIS)?.[0] ?? "");

const messages = [];
for (let i = 1; i <= 6; i++) {
  await p.fill("#email", COMPTES.admin.email);
  await p.fill("#password", `wrong-password-${i}`);
  await p.click('button[type="submit"]');
  const alerte = p.locator('[role="alert"]').first();
  await alerte.waitFor({ timeout: 20000 });
  await p.waitForFunction(() => !document.querySelector('button[type="submit"]')?.textContent?.includes("Signing in"), null, { timeout: 20000 });
  messages.push((await alerte.textContent()).replace(/\s+/g, " ").trim());
}
check("Mauvais mot de passe : « Incorrect email or password. »", messages.slice(0, 5).every((m) => m === "Incorrect email or password."), messages[0]);
check("6ᵉ essai : blocage traduit (« Access temporarily blocked » … « try again in 15 minutes »)",
  messages[5].includes("Access temporarily blocked") && messages[5].includes("Too many failed attempts. Please try again in 15 minutes."), messages[5]);

await p.getByRole("button", { name: "Contact the administration" }).click();
const boite = p.locator(".swal2-popup");
await boite.waitFor();
const titreBoite = (await boite.locator(".swal2-title").textContent()).trim();
await boite.locator(".swal2-confirm").click();
const requis = (await boite.locator(".swal2-validation-message").textContent()).trim();
await p.fill("#swal-email", "pas-une-adresse");
await boite.locator(".swal2-confirm").click();
await p.waitForFunction(() => document.querySelector(".swal2-validation-message")?.textContent?.includes("Invalid"), null, { timeout: 5000 }).catch(() => {});
const invalide = (await boite.locator(".swal2-validation-message").textContent()).trim();
check("Mot de passe oublié : boîte en anglais (titre, boutons, validations)",
  titreBoite === "Forgot your password?" && (await boite.locator(".swal2-confirm").textContent()) === "Send request" &&
  (await boite.locator(".swal2-cancel").textContent()) === "Cancel" && requis === "Email address required" && invalide === "Invalid email address",
  `${titreBoite} / ${requis} / ${invalide}`);
await boite.locator(".swal2-cancel").click(); // annulée : aucune demande enregistrée en base
await p.screenshot({ path: path.join(CAPTURES, "connexion-en-1280.png"), fullPage: true });

// Retour au français depuis la connexion
await selecteur(p).getByRole("link", { name: /FR/ }).click();
await p.waitForURL(`${BASE}/login`);
check("Clic sur FR : /login, lang=fr, cookie langue=fr, textes français",
  (await lang(p)) === "fr" && (await cookieLangue(p)) === "fr" && (await p.locator("h2").first().textContent()) === "Connexion");
check("Connexion FR : mention du challenge exacte en pied de page, intitulé neutre",
  (await p.locator("footer [data-mention-challenge]").innerText()).trim() ===
    "Projet sélectionné dans le cadre du challenge du Ministère de la Transformation Digitale et de l’Innovation" &&
  (await p.locator("main [data-identite]").first().innerText()).includes("RÉPUBLIQUE DU BÉNIN"));
await p.getByRole("button", { name: "Lire" }).click();
check("Lecture vocale : voix française (fr-FR) sur la page française", (await p.evaluate(() => window.__lectures.at(-1))) === "fr-FR");
await p.goto(`${BASE}/`);
check("Cookie fr : / reste en français", chemin(p) === "/" && (await lang(p)) === "fr");
await p.context().close();

// ── 4. Connexion depuis la page anglaise : l'espace reste en français ────────
const c = await contexte();
await c.goto(`${BASE}/en/login?langue=en`);
await c.fill("#email", COMPTES.admin.email);
await c.fill("#password", COMPTES.admin.motDePasse);
await c.click('button[type="submit"]');
await c.waitForURL((u) => u.pathname === "/admin", { timeout: 60000 });
await c.locator("main h1").first().waitFor();
check("Connexion depuis /en/login : arrivée sur /admin en français (lang=fr), malgré le cookie en",
  (await lang(c)) === "fr" && (await c.locator("main h1").first().textContent()).includes("Tableau de bord national") && (await cookieLangue(c)) === "en");
await c.goto(`${BASE}/`);
await c.waitForURL((u) => u.pathname === "/admin", { timeout: 30000 });
check("Connecté avec le cookie en : / mène à l'espace, pas à /en", chemin(c) === "/admin");
await c.context().close();

// ── 5. Affichage à 375 px ────────────────────────────────────────────────────
const m = await contexte({ largeur: 375, hauteur: 812 });
for (const [adresse, nom] of [["/en?langue=en", "accueil"], ["/en/login", "connexion"]]) {
  await m.goto(`${BASE}${adresse}`);
  await m.waitForLoadState("networkidle");
  const boiteSelecteur = await selecteur(m).boundingBox();
  const liens = await selecteur(m).locator("a").evaluateAll((a) => a.map((x) => x.getBoundingClientRect().height));
  check(`375 px, ${nom} EN : pas de défilement horizontal, sélecteur visible dans l'écran, cibles ≥ 36 px`,
    (await largeurPage(m)) <= 375 && boiteSelecteur && boiteSelecteur.x >= 0 && boiteSelecteur.x + boiteSelecteur.width <= 375 && liens.every((h) => h >= 36),
    `${await largeurPage(m)} px`);
  await m.screenshot({ path: path.join(CAPTURES, `${nom}-en-375.png`), fullPage: true });
}
await m.goto(`${BASE}/?langue=fr`);
check("375 px, accueil FR : pas de défilement horizontal", (await largeurPage(m)) <= 375);
await m.screenshot({ path: path.join(CAPTURES, "accueil-fr-375.png"), fullPage: true });
await m.context().close();

await navigateur.close();
check("Aucune erreur JS", erreursJs.length === 0, erreursJs.slice(0, 3).join(" ; "));
rapport.terminer();
