import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest, type NextFetchEvent } from "next/server";

// Proxy : auth(fn) renvoie fn, la session est posée sur la requête
vi.mock("@/auth", () => ({ auth: (arg?: unknown) => (typeof arg === "function" ? arg : null) }));

const { TEXTES, TEXTES_FR } = await import("@/lib/i18n/textes");
const langue = await import("@/lib/i18n/langue");
const { metadonneesPage } = await import("@/lib/i18n/metadonnees");
const { SelecteurLangue } = await import("@/components/SelecteurLangue");
const { default: AccessibilityControls } = await import("@/components/AccessibilityControls");
const { proxy } = await import("@/proxy");

// ── Dictionnaire ─────────────────────────────────────────────────────────────

/** Toutes les feuilles (chemin → texte) d'un dictionnaire. */
function feuilles(objet: unknown, prefixe = ""): Record<string, unknown> {
  if (typeof objet !== "object" || objet === null) return { [prefixe]: objet };
  return Object.assign({}, ...Object.entries(objet).map(([cle, v]) => feuilles(v, prefixe ? `${prefixe}.${cle}` : cle)));
}

const fr = feuilles(TEXTES.fr);
const en = feuilles(TEXTES.en);
// Identiques dans les deux langues, à juste titre
const IDENTIQUES = new Set([
  "commun.nomPlateforme",
  "selecteurLangue.fr",
  "selecteurLangue.en",
  "accueil.chiffres.accessible",
  "connexion.email",
]);

describe("dictionnaire", () => {
  it("le français et l'anglais ont exactement les mêmes clés (listes de même longueur comprises)", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it("aucun texte vide", () => {
    for (const [cle, valeur] of [...Object.entries(fr), ...Object.entries(en)]) {
      expect(typeof valeur === "string" && valeur.trim().length > 0, cle).toBe(true);
    }
  });

  it("chaque texte est traduit (sauf les quelques identiques par nature)", () => {
    const nonTraduits = Object.keys(fr).filter((cle) => !IDENTIQUES.has(cle) && fr[cle] === en[cle]);
    expect(nonTraduits).toEqual([]);
  });

  it("aucun mot français courant dans l'anglais", () => {
    const motsFrancais = /\b(le|la|les|des|du|une|est|pour|vous|votre|élèves?|établissements?|ministère|connexion|mot de passe)\b/i;
    const fautifs = Object.entries(en).filter(([cle, v]) => cle !== "selecteurLangue.fr" && typeof v === "string" && motsFrancais.test(v));
    expect(fautifs).toEqual([]);
  });

  it("nom du ministère : celui déjà affiché sur le site, traduit fidèlement", () => {
    expect(TEXTES.fr.commun.ministere).toBe("Ministère de l'Éducation");
    expect(TEXTES.en.commun.ministere).toBe("Ministry of Education");
  });

  it("le français reprend les textes d'origine (messages de connexion, blocage, mot de passe oublié)", () => {
    expect(TEXTES_FR.connexion).toMatchObject({
      erreurIdentifiants: "Email ou mot de passe incorrect.",
      bloqueTitre: "Accès temporairement bloqué",
      bloqueDetail: "Trop de tentatives échouées. Réessayez dans 15 minutes.",
      bouton: "Se connecter",
    });
    expect(TEXTES_FR.connexion.oubli.titre).toBe("Mot de passe oublié ?");
  });

  it("voix de lecture : française en français, anglaise en anglais", () => {
    expect(TEXTES.fr.accessibiliteControles.voix).toBe("fr-FR");
    expect(TEXTES.en.accessibiliteControles.voix).toMatch(/^en-/);
  });
});

// ── Langue des adresses ──────────────────────────────────────────────────────

describe("langue des adresses", () => {
  it.each([
    ["/", "accueil", "fr"],
    ["/en", "accueil", "en"],
    ["/login", "connexion", "fr"],
    ["/en/login", "connexion", "en"],
  ])("%s : page %s en %s", (chemin, page, l) => {
    expect(langue.pagePublique(chemin)).toEqual({ page, langue: l });
    expect(langue.langueDuChemin(chemin)).toBe(l);
  });

  it.each(["/admin", "/enseignant/etudiants/x", "/en/admin", "/etudiant", "/profil"])("%s : reste de l'application, toujours en français", (chemin) => {
    expect(langue.pagePublique(chemin)).toBeNull();
    expect(langue.langueDuChemin(chemin)).toBe("fr");
  });

  it("lien du sélecteur : adresse de la langue choisie avec le paramètre", () => {
    expect(langue.lienChangementLangue("connexion", "en")).toBe("/en/login?langue=en");
    expect(langue.lienChangementLangue("accueil", "fr")).toBe("/?langue=fr");
  });

  it("estLangue : fr et en seulement", () => {
    expect(["fr", "en", "de", "", null, undefined].map(langue.estLangue)).toEqual([true, true, false, false, false, false]);
  });
});

// ── Métadonnées SEO ──────────────────────────────────────────────────────────

describe("métadonnées", () => {
  it.each([
    ["accueil", "fr", "/", "fr_FR", "en_US"],
    ["accueil", "en", "/en", "en_US", "fr_FR"],
    ["connexion", "fr", "/login", "fr_FR", "en_US"],
    ["connexion", "en", "/en/login", "en_US", "fr_FR"],
  ] as const)("%s en %s : canonique, hreflang, Open Graph", (page, l, chemin, locale, autre) => {
    const m = metadonneesPage(page, l);
    expect(m.title).toBe(TEXTES[l].metadonnees[page].titre);
    expect(m.description).toBe(TEXTES[l].metadonnees[page].description);
    expect(m.alternates?.canonical).toBe(chemin);
    expect(m.alternates?.languages).toEqual({
      fr: langue.CHEMINS[page].fr,
      en: langue.CHEMINS[page].en,
      "x-default": langue.CHEMINS[page].fr,
    });
    expect(m.openGraph).toMatchObject({ title: m.title, description: m.description, url: chemin, locale, alternateLocale: [autre] });
  });
});

// ── Composants ───────────────────────────────────────────────────────────────

describe("SelecteurLangue", () => {
  const attributs = (html: string, l: string) => html.match(new RegExp(`<a [^>]*hrefLang="${l}"[^>]*>`, "i"))?.[0] ?? "";

  it("deux liens FR et EN, langue courante marquée, noms accessibles complets", () => {
    const html = renderToStaticMarkup(<SelecteurLangue page="connexion" langue="en" variante="clair" />);
    expect(html).toContain('aria-label="Language selection"');
    expect(attributs(html, "fr")).toContain('href="/login?langue=fr"');
    expect(attributs(html, "fr")).toContain('lang="fr"');
    expect(attributs(html, "fr")).not.toContain("aria-current");
    expect(attributs(html, "en")).toContain('href="/en/login?langue=en"');
    expect(attributs(html, "en")).toContain('aria-current="true"');
    expect(html).toContain("— Français");
    expect(html).toContain("— English");
  });

  it("en français : libellé du groupe en français", () => {
    expect(renderToStaticMarkup(<SelecteurLangue page="accueil" langue="fr" />)).toContain('aria-label="Choix de la langue"');
  });
});

describe("AccessibilityControls", () => {
  it("français par défaut (reste de l'application)", () => {
    const html = renderToStaticMarkup(<AccessibilityControls />);
    expect(html).toContain('aria-label="Options d&#x27;accessibilité"');
    expect(html).toContain('aria-label="Augmenter la taille du texte"');
    expect(html).toContain(">Lire<");
  });

  it("anglais avec les textes anglais", () => {
    const html = renderToStaticMarkup(<AccessibilityControls variant="light" textes={TEXTES.en.accessibiliteControles} />);
    expect(html).toContain('aria-label="Accessibility options"');
    expect(html).toContain('aria-label="Increase text size"');
    expect(html).toContain('title="Turn on high contrast"');
    expect(html).toContain(">Read aloud<");
    expect(html).not.toMatch(/Lire|Contraste|Taille/);
  });
});

// ── Proxy ────────────────────────────────────────────────────────────────────

async function appeler(chemin: string, { cookie, connecte = false }: { cookie?: string; connecte?: boolean } = {}) {
  const req = new NextRequest(`https://exemple.bj${chemin}`, cookie ? { headers: { cookie: `langue=${cookie}` } } : undefined) as NextRequest & {
    auth: unknown;
  };
  req.auth = connecte ? { user: { role: "admin" } } : null;
  const res = await proxy(req, {} as NextFetchEvent);
  return {
    redirection: res?.headers.get("location") ?? null,
    cookie: res?.headers.get("set-cookie") ?? null,
    langue: res?.headers.get("x-middleware-request-x-edutech-langue") ?? null,
  };
}

describe("proxy : langue", () => {
  it.each([
    ["/", "fr"],
    ["/en", "en"],
    ["/login", "fr"],
    ["/en/login", "en"],
  ])("%s : langue transmise à la mise en page (%s)", async (chemin, l) => {
    expect(await appeler(chemin)).toMatchObject({ redirection: null, langue: l });
  });

  it("sélecteur ?langue=en : cookie d'un an posé, redirection vers l'adresse anglaise", async () => {
    const r = await appeler("/login?langue=en");
    expect(r.redirection).toBe("https://exemple.bj/en/login");
    expect(r.cookie).toMatch(/^langue=en;/);
    expect(r.cookie).toMatch(/Max-Age=31536000/i);
    expect(r.cookie).toMatch(/Path=\//i);
    expect(r.cookie).toMatch(/HttpOnly/i);
    expect(r.cookie).toMatch(/SameSite=lax/i);
    expect(r.cookie).toMatch(/Secure/i);
  });

  it("sélecteur ?langue=fr depuis l'anglais : cookie fr, retour à l'adresse française", async () => {
    const r = await appeler("/en?langue=fr", { cookie: "en" });
    expect(r.redirection).toBe("https://exemple.bj/");
    expect(r.cookie).toMatch(/^langue=fr;/);
  });

  it("paramètre inconnu : ignoré", async () => {
    expect(await appeler("/login?langue=de")).toMatchObject({ redirection: null, cookie: null, langue: "fr" });
  });

  it("cookie en : / et /login redirigent vers la version anglaise", async () => {
    expect((await appeler("/", { cookie: "en" })).redirection).toBe("https://exemple.bj/en");
    expect((await appeler("/login", { cookie: "en" })).redirection).toBe("https://exemple.bj/en/login");
  });

  it("cookie fr : une adresse anglaise explicite est respectée", async () => {
    expect(await appeler("/en/login", { cookie: "fr" })).toMatchObject({ redirection: null, langue: "en" });
  });

  it("personne connectée avec le cookie en : pas de redirection vers /en (son espace reste en français)", async () => {
    expect((await appeler("/", { cookie: "en", connecte: true })).redirection).toBeNull();
  });

  it("reste de l'application : toujours en français, même avec le cookie en", async () => {
    expect(await appeler("/admin", { cookie: "en", connecte: true })).toMatchObject({ redirection: null, langue: "fr" });
  });

  it("un client ne peut pas imposer la langue par l'en-tête : il est écrasé", async () => {
    const req = new NextRequest("https://exemple.bj/admin", { headers: { "x-edutech-langue": "en" } }) as NextRequest & { auth: unknown };
    req.auth = { user: { role: "admin" } };
    const res = await proxy(req, {} as NextFetchEvent);
    expect(res?.headers.get("x-middleware-request-x-edutech-langue")).toBe("fr");
  });
});
