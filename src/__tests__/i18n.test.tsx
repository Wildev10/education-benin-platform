import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest, type NextFetchEvent } from "next/server";

// Proxy : auth(fn) renvoie fn, la session est posée sur la requête
vi.mock("@/auth", () => ({ auth: (arg?: unknown) => (typeof arg === "function" ? arg : null) }));

const { TEXTES, TEXTES_FR, NOM_MINISTERE_CHALLENGE } = await import("@/lib/i18n/textes");
const { BlocIdentite, MentionChallenge } = await import("@/components/IdentitePlateforme");
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
  "accueil.piedDePage", // « © 2026 EduTech Bénin »
  // Valeurs des seuils d'alerte (« −15 % », « 5 »…), identiques dans les deux langues
  ...[0, 1, 2, 3].map((i) => `accueil.seuils.${i}.valeur`),
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

  it("intitulé neutre : « République du Bénin » et « Plateforme nationale de suivi scolaire »", () => {
    expect(TEXTES.fr.commun).toMatchObject({ pays: "République du Bénin", intitule: "Plateforme nationale de suivi scolaire" });
    expect(TEXTES.en.commun).toMatchObject({ pays: "Republic of Benin", intitule: "National student monitoring platform" });
  });

  it("mention du challenge recopiée exactement, apostrophe typographique comprise, nom gardé en français", () => {
    expect(NOM_MINISTERE_CHALLENGE).toBe("Ministère de la Transformation Digitale et de l’Innovation");
    expect(`${TEXTES.fr.commun.mentionChallenge} ${NOM_MINISTERE_CHALLENGE}`).toBe(
      "Projet sélectionné dans le cadre du challenge du Ministère de la Transformation Digitale et de l’Innovation"
    );
    expect(`${TEXTES.en.commun.mentionChallenge} ${NOM_MINISTERE_CHALLENGE}`).toBe(
      "Project selected as part of the challenge organized by the Ministère de la Transformation Digitale et de l’Innovation"
    );
  });

  it("aucun texte ne présente la plateforme comme le service d'un ministère", () => {
    const tout = JSON.stringify(TEXTES);
    expect(tout).not.toMatch(/Ministère de l'Éducation|Ministry of Education|\bMinistry\b|Le ministère/);
    // Le seul ministère cité est celui du challenge, hors du dictionnaire
    expect(tout).not.toMatch(/Ministère/);
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

// ── Faits affichés sur l'accueil et la connexion ─────────────────────────────

describe("faits affichés : vrais et vérifiables dans le code", () => {
  it("les seuils de l'accueil sont ceux des règles de détection", async () => {
    const { calculerNiveauAlerte, calculerNiveauAlerteAbsence } = await import("@/lib/detection-alerte");
    expect(TEXTES.fr.accueil.seuils.map((s) => s.valeur)).toEqual(["−15 %", "−20 %", "5", "10"]);
    // −15 % : moyen (juste en dessous : rien)
    expect(calculerNiveauAlerte(20, 17)).toBe("moyen");
    expect(calculerNiveauAlerte(20, 17.02)).toBeNull();
    // −20 % et moyenne sous 10/20 : élevé ; −20 % au-dessus de 10/20 : seulement moyen
    expect(calculerNiveauAlerte(12, 9.6)).toBe("eleve");
    expect(calculerNiveauAlerte(15, 12)).toBe("moyen");
    // 5 et 10 absences injustifiées
    expect([4, 5, 9, 10].map(calculerNiveauAlerteAbsence)).toEqual([null, "moyen", "moyen", "eleve"]);
  });

  it("plus aucune affirmation fausse : ni IA, ni « tous les établissements du Bénin », ni chiffres invérifiables", () => {
    const tout = JSON.stringify(TEXTES);
    expect(tout).not.toMatch(/\bIA\b|\bAI\b|intelligence artificielle|Tous les établissements du Bénin|All schools in Benin|70\+|24\/7|100 ?%/);
    expect(TEXTES.fr.connexion.atouts.map((a) => a.titre)).toEqual(["Suivi en temps réel", "Détection par règles", "Vue nationale"]);
  });

  it("titres concrets à la place des titres de modèle", () => {
    const tout = JSON.stringify(TEXTES);
    expect(tout).not.toMatch(/Comment ça marche|pour chaque acteur|Conçu pour tous|How does it work|every stakeholder|Designed for everyone/);
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

describe("identité de la plateforme", () => {
  it("bloc : « République du Bénin » au-dessus du nom puis de l'intitulé", () => {
    const html = renderToStaticMarkup(<BlocIdentite langue="fr" />);
    const ordre = ["République du Bénin", "EduTech Bénin", "Plateforme nationale de suivi scolaire"].map((t) => html.indexOf(t));
    expect(ordre.every((i) => i >= 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });

  it("mention en anglais : le nom du ministère balisé lang=fr pour les lecteurs d'écran", () => {
    const html = renderToStaticMarkup(<MentionChallenge langue="en" />);
    expect(html).toContain(`Project selected as part of the challenge organized by the <span lang="fr">${NOM_MINISTERE_CHALLENGE}</span>`);
  });
});

describe("garde-fou : plus de « ministère de l'Éducation » dans le code", () => {
  it("aucun fichier de src/ ne le mentionne (ni « Dashboard Ministère »)", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const path = await import("node:path");
    const racine = path.join(import.meta.dirname, "..");
    const fichiers: string[] = [];
    const parcourir = (dossier: string) => {
      for (const nom of readdirSync(dossier)) {
        const chemin = path.join(dossier, nom);
        if (nom === "generated" || nom === "__tests__") continue;
        if (statSync(chemin).isDirectory()) parcourir(chemin);
        else if (/\.(tsx?|mjs|css)$/.test(nom)) fichiers.push(chemin);
      }
    };
    parcourir(racine);
    const fautifs = fichiers.filter((f) => /Ministère de l(&apos;|'|’)Éducation|Ministry of Education|Dashboard Ministère|Espace Ministère/.test(readFileSync(f, "utf8")));
    expect(fichiers.length).toBeGreaterThan(50);
    expect(fautifs.map((f) => path.relative(racine, f))).toEqual([]);
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

async function appeler(
  chemin: string,
  { cookie, connecte = false, role = "admin" }: { cookie?: string; connecte?: boolean; role?: string } = {}
) {
  const req = new NextRequest(`https://exemple.bj${chemin}`, cookie ? { headers: { cookie: `langue=${cookie}` } } : undefined) as NextRequest & {
    auth: unknown;
  };
  req.auth = connecte ? { user: { role } } : null;
  const res = await proxy(req, {} as NextFetchEvent);
  return {
    redirection: res?.headers.get("location") ?? null,
    cookie: res?.headers.get("set-cookie") ?? null,
  };
}

describe("proxy : langue", () => {
  it.each(["/", "/en", "/login", "/en/login"])("%s : page publique servie sans redirection", async (chemin) => {
    expect(await appeler(chemin)).toMatchObject({ redirection: null, cookie: null });
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
    expect(await appeler("/login?langue=de")).toMatchObject({ redirection: null, cookie: null });
  });

  it("cookie en : / et /login redirigent vers la version anglaise", async () => {
    expect((await appeler("/", { cookie: "en" })).redirection).toBe("https://exemple.bj/en");
    expect((await appeler("/login", { cookie: "en" })).redirection).toBe("https://exemple.bj/en/login");
  });

  it("cookie fr : une adresse anglaise explicite est respectée", async () => {
    expect(await appeler("/en/login", { cookie: "fr" })).toMatchObject({ redirection: null });
  });

  it("personne connectée avec le cookie en : envoyée vers son espace, en français, pas vers /en", async () => {
    expect((await appeler("/", { cookie: "en", connecte: true })).redirection).toBe("https://exemple.bj/admin");
  });

  it.each([
    ["admin", "/admin"],
    ["directeur", "/directeur"],
    ["enseignant", "/enseignant"],
    ["etudiant", "/etudiant"],
  ])("accueil statique : %s connecté redirigé vers %s, depuis / comme depuis /en", async (role, espace) => {
    expect((await appeler("/", { connecte: true, role })).redirection).toBe(`https://exemple.bj${espace}`);
    expect((await appeler("/en", { connecte: true, role })).redirection).toBe(`https://exemple.bj${espace}`);
  });

  it("connexion : une personne connectée n'est pas redirigée (comportement inchangé)", async () => {
    expect((await appeler("/login", { connecte: true })).redirection).toBeNull();
  });

  it("reste de l'application : pas de redirection vers l'anglais, même avec le cookie en", async () => {
    expect(await appeler("/admin", { cookie: "en", connecte: true })).toMatchObject({ redirection: null });
  });
});
