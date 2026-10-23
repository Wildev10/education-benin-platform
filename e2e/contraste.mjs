// Mode « Contraste » (contraste élevé) sur les pages des quatre rôles, à 375 px
// et 1280 px : textes à 7:1 au moins (4,5:1 pour les grands textes, niveau
// AAA), couleurs d'état gardées mais assombries et doublées d'un libellé,
// bordures de 2 px, repère de focus épais et décalé, soulignement réservé aux
// liens dans le texte, en-tête et armoiries gardés ; cloche ouverte, fenêtre
// SweetAlert2, graphiques, accordéon. Mode « couleurs forcées » de Windows
// vérifié à part. Captures dans e2e/resultats/captures/contraste. Aucune écriture en base.
import path from "node:path";
import { BASE, COMPTES, connecter, creerRapport, dossierResultats, lancerNavigateur, ouvrir } from "./commun.mjs";
import { preferencesAccessibilite } from "./analyse-mise-en-page.mjs";

const rapport = creerRapport("Contraste élevé");
const { check, ignorer } = rapport;
const navigateur = await lancerNavigateur();
const CAPTURES = dossierResultats("captures", "contraste");

const ACCENT = "rgb(138, 44, 13)"; // #8A2C0D
const ROUGE = "rgb(127, 29, 29)"; // #7F1D1D, texte du niveau Élevé
const ORANGE_BRUN = "rgb(107, 47, 6)"; // #6B2F06, texte du niveau Moyen
const PALETTE_GRAPHIQUES = ["#8A2C0D", "#065F46", "#B45309", "#991B1B"];

/**
 * Textes visibles dont le contraste avec leur fond (fonds semi-transparents
 * composés, SVG compris) est sous 7:1, ou 4,5:1 pour un grand texte.
 */
function textesSousLeSeuil(page, racine = "body") {
  return page.evaluate((racine) => {
    const rgba = (c) => {
      const m = c && c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r, g, b, a };
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const mix = (haut, bas) => ({
      r: haut.r * haut.a + bas.r * (1 - haut.a), g: haut.g * haut.a + bas.g * (1 - haut.a), b: haut.b * haut.a + bas.b * (1 - haut.a), a: 1,
    });
    const fond = (el) => {
      const pile = [];
      for (let a = el; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.backgroundImage !== "none" && !s.backgroundImage.startsWith("url")) return null; // dégradé : non calculable
        const c = rgba(s.backgroundColor);
        if (c && c.a > 0) {
          pile.push(c);
          if (c.a >= 0.99) break;
        }
      }
      let base = { r: 255, g: 255, b: 255, a: 1 };
      for (const c of pile.reverse()) base = c.a >= 0.99 ? c : mix(c, base);
      return base;
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      for (let a = el; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.5 || a.classList?.contains("sr-only")) return false;
      }
      return true;
    };
    const echecs = [];
    for (const el of document.querySelectorAll(`${racine} *`)) {
      const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      // Commandes désactivées : exemptées par le WCAG
      if (!direct || !visible(el) || el.closest("[disabled], [aria-disabled='true']")) continue;
      const s = getComputedStyle(el);
      let texte = rgba(el instanceof SVGElement ? s.fill : s.color);
      const f = fond(el);
      if (!texte || !f) continue;
      if (texte.a < 0.99) texte = mix(texte, f);
      const [l1, l2] = [lum(texte), lum(f)].sort((a, b) => b - a);
      const ratio = (l1 + 0.05) / (l2 + 0.05);
      const taille = parseFloat(s.fontSize);
      const grand = taille >= 24 || (taille >= 18.66 && Number(s.fontWeight) >= 700);
      if (ratio < (grand ? 4.5 : 7)) echecs.push(`${el.tagName.toLowerCase()} « ${el.textContent.trim().slice(0, 30)} » ${ratio.toFixed(2)}`);
    }
    return [...new Set(echecs)];
  }, racine);
}

async function verifierPage(page, role, chemin, largeur) {
  const nom = `${role} ${chemin} ${largeur} px`;
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  check(`${nom} : contraste élevé appliqué`, theme === "high-contrast", theme);
  const echecs = await textesSousLeSeuil(page);
  check(`${nom} : textes à 7:1 au moins (4,5:1 grands textes)`, echecs.length === 0, echecs.slice(0, 4).join(" | "));
  const debord = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`${nom} : pas de défilement horizontal`, debord <= largeur, `${debord} px`);
  await page.screenshot({ path: path.join(CAPTURES, `${role}${chemin.replace(/\//g, "_")}-${largeur}.png`), fullPage: true });
}

/** En-tête sombre gardé, armoiries sur fond blanc, menu sans soulignement, onglet actif marqué. */
async function verifierEnTeteEtMenu(page, nom) {
  const entete = await page.evaluate(() => {
    const header = document.querySelector("header");
    const armoiries = document.querySelector('header img[alt="Armoiries du Bénin"]');
    const r = armoiries?.getBoundingClientRect();
    const liens = [...document.querySelectorAll("nav a")].filter((a) => a.offsetParent);
    const actif = liens.find((a) => a.getAttribute("aria-current") === "page");
    return {
      fond: getComputedStyle(header).backgroundColor,
      armoiries: !!r && r.width >= 30 && getComputedStyle(armoiries.parentElement).backgroundColor === "rgb(255, 255, 255)",
      soulignes: liens.filter((a) => getComputedStyle(a).textDecorationLine.includes("underline")).length,
      actif: actif ? `${getComputedStyle(actif).borderBottomColor} ${getComputedStyle(actif).boxShadow}` : null,
    };
  });
  check(`${nom} : en-tête noir gardé, armoiries visibles sur fond blanc`, entete.fond === "rgb(0, 0, 0)" && entete.armoiries, JSON.stringify(entete));
  check(`${nom} : menu sans soulignement`, entete.soulignes === 0, `${entete.soulignes} lien(s) souligné(s)`);
  if (entete.actif !== null) check(`${nom} : onglet actif marqué par l'accent assombri`, entete.actif.includes(ACCENT), entete.actif);
}

async function session(compte, largeur) {
  const page = await connecter(navigateur, compte, { largeur, hauteur: largeur < 500 ? 812 : 900 });
  await preferencesAccessibilite(page.context(), { contrasteEleve: true });
  return page;
}

async function verifierCloche(page, nom) {
  await page.locator('button[aria-label^="Notifications"]').first().click();
  const liste = page.locator('[aria-label="Dernières alertes"]').first();
  await liste.waitFor({ timeout: 15000 });
  const echecs = await textesSousLeSeuil(page, '[aria-label="Dernières alertes"]');
  check(`${nom} : cloche ouverte, textes à 7:1 au moins`, echecs.length === 0, echecs.slice(0, 3).join(" | "));
  const bordure = await liste.evaluate((el) => `${getComputedStyle(el).borderTopWidth} ${getComputedStyle(el).borderTopColor}`);
  check(`${nom} : cloche ouverte, bordure de 2 px foncée`, bordure === "2px rgb(77, 77, 77)", bordure);
  await page.keyboard.press("Escape");
}

const PAGES = {
  admin: ["/admin", "/admin/alertes", "/admin/absences", "/admin/etudiants", "/admin/utilisateurs", "/admin/historique", "/admin/import", "/admin/assistant", "/profil"],
  directeur: ["/directeur", "/directeur/alertes", "/directeur/absences"],
  enseignant: ["/enseignant", "/enseignant/alertes", "/enseignant/absences", "/enseignant/import", "/enseignant/assistant"],
  etudiant: ["/etudiant"],
};
const FICHES = { admin: ["/admin/etudiants", "/admin/etudiants/"], enseignant: ["/enseignant", "/enseignant/etudiants/"] };

for (const largeur of [375, 1280]) {
  // ── Pages publiques ──
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: 900 } });
  await preferencesAccessibilite(contexte, { contrasteEleve: true });
  const pub = await contexte.newPage();
  for (const chemin of ["/", "/login"]) {
    await pub.goto(`${BASE}${chemin}`);
    await pub.waitForLoadState("networkidle");
    await pub.waitForFunction(() => document.documentElement.dataset.theme === "high-contrast");
    await verifierPage(pub, "public", chemin === "/" ? "/accueil" : chemin, largeur);
  }
  // Fenêtre SweetAlert2 (mot de passe oublié) : textes et boutons lisibles
  await pub.getByRole("button", { name: /administration/i }).first().click();
  await pub.locator(".swal2-popup").waitFor();
  const echecsSwal = await textesSousLeSeuil(pub, ".swal2-container");
  const annuler = await pub.locator(".swal2-cancel").evaluate((b) => `${getComputedStyle(b).backgroundColor} ${getComputedStyle(b).color}`);
  check(`Connexion ${largeur} px : fenêtre SweetAlert2 à 7:1 au moins, bouton Annuler noir et blanc`,
    echecsSwal.length === 0 && annuler === "rgb(0, 0, 0) rgb(255, 255, 255)", `${echecsSwal.join(" | ")} ${annuler}`);
  await pub.screenshot({ path: path.join(CAPTURES, `login-swal-${largeur}.png`) });
  await contexte.close();

  for (const [role, chemins] of Object.entries(PAGES)) {
    const compte = COMPTES[role];
    if (!compte) {
      ignorer(`${role} ${largeur} px`, "compte non configuré (.env.e2e.local)");
      continue;
    }
    const page = await session(compte, largeur);
    for (const chemin of chemins) {
      await ouvrir(page, chemin);
      await verifierPage(page, role, chemin, largeur);
    }
    await ouvrir(page, chemins[0]);
    await verifierEnTeteEtMenu(page, `${role} ${largeur} px`);

    // Fiche élève et accordéon des trimestres
    if (FICHES[role]) {
      const [liste, prefixe] = FICHES[role];
      await ouvrir(page, liste);
      const fiche = await page.locator(`main a[href^="${prefixe}"]`).first().getAttribute("href").catch(() => null);
      if (fiche) {
        await ouvrir(page, fiche);
        const ferme = page.locator('[data-entete-trimestre][aria-expanded="false"]').first();
        if (await ferme.count()) await ferme.click();
        await verifierPage(page, role, "/fiche", largeur);
      } else ignorer(`${role} ${largeur} px : fiche élève`, "aucun élève dans la liste");
    }

    if (role !== "etudiant") {
      await ouvrir(page, chemins[0]);
      await verifierCloche(page, `${role} ${largeur} px`);
    }
    await page.context().close();
  }
}

// ── Couleurs d'état, bordures, focus, graphiques (admin, 1280 px) ──
const admin = await session(COMPTES.admin, 1280);
await ouvrir(admin, "/admin/alertes");
const etats = await admin.evaluate(() => {
  const badge = (texte) => [...document.querySelectorAll("main span")].find((s) => s.textContent.trim().endsWith(texte) && s.className.includes("rounded-full"));
  const style = (el) => el && { couleur: getComputedStyle(el).color, bordure: getComputedStyle(el).borderTopWidth };
  return { eleve: style(badge("Élevé")), moyen: style(badge("Moyen")) };
});
check("Niveau Élevé : rouge foncé, libellé écrit, bordure de 2 px", etats.eleve?.couleur === ROUGE && etats.eleve?.bordure === "2px", JSON.stringify(etats.eleve));
check("Niveau Moyen : orange brun, libellé écrit, bordure de 2 px", etats.moyen?.couleur === ORANGE_BRUN && etats.moyen?.bordure === "2px", JSON.stringify(etats.moyen));

await ouvrir(admin, "/admin");
const cartes = await admin.locator("main .rounded-\\[14px\\].border, main .rounded-2xl.border").first().evaluate((el) => `${getComputedStyle(el).borderTopWidth} ${getComputedStyle(el).borderTopColor}`);
check("Cartes : bordure de 2 px foncée", cartes === "2px rgb(77, 77, 77)", cartes);
const boutonsNonSoulignes = await admin.evaluate(() => [...document.querySelectorAll("main button")].filter((b) => getComputedStyle(b).textDecorationLine.includes("underline")).length);
check("Boutons : pas de soulignement", boutonsNonSoulignes === 0, `${boutonsNonSoulignes}`);

// Repère de focus au clavier : contour de 3 px, décalé de 3 px, dans l'en-tête comme dans la page
const reperes = [];
for (let i = 0; i < 14; i++) {
  await admin.keyboard.press("Tab");
  reperes.push(await admin.evaluate(() => {
    const el = document.activeElement;
    const s = getComputedStyle(el);
    return { dansEntete: !!el.closest("header"), contour: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineOffset} ${s.outlineColor}` };
  }));
}
const enTete = reperes.find((r) => r.dansEntete);
const corps = reperes.find((r) => !r.dansEntete);
check("Focus : contour blanc de 3 px décalé de 3 px dans l'en-tête sombre", enTete?.contour === "solid 3px 3px rgb(255, 255, 255)", enTete?.contour);
check("Focus : contour noir de 3 px décalé de 3 px dans la page", corps?.contour === "solid 3px 3px rgb(0, 0, 0)", corps?.contour);
await admin.screenshot({ path: path.join(CAPTURES, "focus-1280.png") });

// Graphique : barres et libellés aux couleurs assombries
await admin.locator(".recharts-rectangle").first().waitFor({ timeout: 15000 });
const graphique = await admin.evaluate(() => ({
  barres: [...new Set([...document.querySelectorAll(".recharts-rectangle")].map((r) => r.getAttribute("fill")?.toUpperCase()))],
  axes: [...new Set([...document.querySelectorAll(".recharts-cartesian-axis-tick-value")].map((t) => t.getAttribute("fill")?.toUpperCase()))],
}));
check("Graphique admin : barres en accent assombri, libellés d'axes foncés",
  graphique.barres.every((c) => PALETTE_GRAPHIQUES.includes(c)) && graphique.axes.every((c) => ["#000000", "#333333"].includes(c)), JSON.stringify(graphique));

// Fenêtre de modification d'un compte (SweetAlert2) : champs à bordure de 2 px
await ouvrir(admin, "/admin/utilisateurs");
await admin.getByRole("button", { name: /^Modifier/ }).first().click();
await admin.locator(".swal2-popup").waitFor();
const swal = await admin.evaluate(() => ({
  champ: `${getComputedStyle(document.querySelector(".swal-input")).borderTopWidth} ${getComputedStyle(document.querySelector(".swal-input")).borderTopColor}`,
  cadre: getComputedStyle(document.querySelector(".swal2-popup")).borderTopWidth,
}));
const echecsModif = await textesSousLeSeuil(admin, ".swal2-container");
check("Fenêtre « Modifier le compte » : textes à 7:1 au moins, cadre et champs de 2 px",
  echecsModif.length === 0 && swal.champ === "2px rgb(89, 89, 89)" && swal.cadre === "2px", `${echecsModif.join(" | ")} ${JSON.stringify(swal)}`);
await admin.screenshot({ path: path.join(CAPTURES, "swal-modifier-1280.png") });
await admin.keyboard.press("Escape");
await admin.context().close();

// Graphiques du directeur : moyennes en vert foncé, orange brun ou rouge foncé
if (COMPTES.directeur) {
  const directeur = await session(COMPTES.directeur, 1280);
  await ouvrir(directeur, "/directeur");
  await directeur.locator(".recharts-rectangle").first().waitFor({ timeout: 15000 });
  const couleurs = await directeur.evaluate(() => ({
    barres: [...new Set([...document.querySelectorAll(".recharts-rectangle")].map((r) => r.getAttribute("fill")?.toUpperCase()))],
    courbe: document.querySelector(".recharts-line-curve")?.getAttribute("stroke")?.toUpperCase(),
  }));
  check("Graphiques directeur : barres et courbe aux couleurs assombries",
    couleurs.barres.every((c) => PALETTE_GRAPHIQUES.includes(c)) && couleurs.courbe === "#8A2C0D", JSON.stringify(couleurs));
  await directeur.context().close();
} else ignorer("Graphiques directeur", "compte non configuré (.env.e2e.local)");

// ── Hors contraste élevé : thème habituel inchangé ──
const normal = await connecter(navigateur, COMPTES.admin);
await ouvrir(normal, "/admin");
const fondNormal = await normal.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.body).backgroundColor]);
check("Sans contraste élevé : fond et thème habituels", fondNormal[0] === "default" && fondNormal[1] === "rgb(250, 250, 250)", fondNormal.join(" "));
await normal.context().close();

// ── Couleurs forcées (Windows) : comportement séparé ──
for (const contrasteEleve of [false, true]) {
  const page = await connecter(navigateur, COMPTES.admin);
  await preferencesAccessibilite(page.context(), { contrasteEleve });
  await page.emulateMedia({ forcedColors: "active" });
  await ouvrir(page, "/admin");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const forcees = await page.evaluate(() => ({
    actif: matchMedia("(forced-colors: active)").matches,
    contour: `${getComputedStyle(document.activeElement).outlineStyle} ${getComputedStyle(document.activeElement).outlineWidth}`,
    ombres: [...document.querySelectorAll(".cadre-ombre")].every((o) => getComputedStyle(o).display === "none"),
  }));
  check(`Couleurs forcées${contrasteEleve ? " + contraste élevé" : ""} : actives, repère de focus de 3 px, ombres décoratives retirées`,
    forcees.actif && forcees.contour === "solid 3px" && forcees.ombres, JSON.stringify(forcees));
  check(`Couleurs forcées${contrasteEleve ? " + contraste élevé" : ""} : aucune erreur JavaScript`, page.erreursJs.length === 0, page.erreursJs.join(" | "));
  await page.context().close();
}

await navigateur.close();
rapport.terminer();
