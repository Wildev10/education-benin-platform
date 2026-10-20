// Outils partagés des scénarios navigateur (e2e/). Importer ce module vérifie
// la base de données : un scénario refuse de démarrer sur une base protégée.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { chromium } from "playwright-core";

export const RACINE = fileURLToPath(new URL("..", import.meta.url));
export const PORT = Number(process.env.E2E_PORT ?? 3100);
export const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
export const DOSSIER_RESULTATS = path.join(RACINE, "e2e", "resultats");

// Mêmes fichiers et même priorité que `next start` : une variable déjà définie
// n'est jamais écrasée, donc le premier fichier lu l'emporte. .env.e2e.local
// contient les réglages propres aux tests (compte directeur) ; tous facultatifs.
for (const fichier of [".env.e2e.local", ".env.production.local", ".env.local", ".env.production", ".env"]) {
  dotenv.config({ path: path.join(RACINE, fichier), quiet: true });
}

// ── Garde-fou : jamais sur la base de production ─────────────────────────────

function refuser(raison) {
  console.error(`\n⛔  Tests navigateur bloqués : ${raison}.\n    Utilisez une base de développement.\n`);
  process.exit(1);
}

/**
 * Refuse de continuer si DATABASE_URL pointe vers un hôte de PROTECTED_DB_HOSTS.
 * Contrairement à prisma/garde-prod.ts, aucune option ne permet de passer outre,
 * et une liste vide bloque aussi : on ne peut alors rien vérifier.
 */
export function verifierBaseDeTest() {
  const url = process.env.DATABASE_URL;
  if (!url) refuser("DATABASE_URL n'est pas définie");

  const protegees = (process.env.PROTECTED_DB_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  if (protegees.length === 0) {
    refuser("PROTECTED_DB_HOSTS est vide, impossible de vérifier que la base n'est pas celle de production");
  }

  let hote;
  try {
    hote = new URL(url).hostname;
  } catch {
    hote = url; // format non standard : recherche brute
  }
  const protegee = protegees.find((h) => hote.includes(h));
  if (protegee) refuser(`la base configurée (${protegee}) figure dans PROTECTED_DB_HOSTS`);
  return hote;
}

export const HOTE_BASE = verifierBaseDeTest();

// ── Comptes ──────────────────────────────────────────────────────────────────

// Comptes de démonstration documentés dans le README. Le directeur n'y figure
// pas : il est lu dans l'environnement (E2E_DIRECTEUR_EMAIL, E2E_DIRECTEUR_MOT_DE_PASSE),
// et les étapes qui le concernent sont ignorées s'il n'est pas configuré.
const MOT_DE_PASSE_DEMO = process.env.E2E_MOT_DE_PASSE ?? "password123";
export const COMPTES = {
  admin: { email: "admin@edutech.bj", motDePasse: MOT_DE_PASSE_DEMO },
  enseignant: { email: "enseignant@edutech.bj", motDePasse: MOT_DE_PASSE_DEMO },
  etudiant: { email: "etudiant@edutech.bj", motDePasse: MOT_DE_PASSE_DEMO },
  directeur:
    process.env.E2E_DIRECTEUR_EMAIL && process.env.E2E_DIRECTEUR_MOT_DE_PASSE
      ? { email: process.env.E2E_DIRECTEUR_EMAIL, motDePasse: process.env.E2E_DIRECTEUR_MOT_DE_PASSE }
      : null,
};

// ── Rapport ──────────────────────────────────────────────────────────────────

export function creerRapport(scenario) {
  const resultats = [];
  console.log(`\n── ${scenario} ${"─".repeat(Math.max(0, 60 - scenario.length))}`);
  return {
    check(nom, ok, detail = "") {
      resultats.push({ nom, ok: !!ok });
      console.log(`${ok ? "✅" : "❌"} ${nom}${detail ? ` — ${detail}` : ""}`);
      return !!ok;
    },
    ignorer(nom, raison) {
      console.log(`⏭️  ${nom} — ignoré : ${raison}`);
    },
    terminer() {
      const ko = resultats.filter((r) => !r.ok).length;
      console.log(`${resultats.length - ko}/${resultats.length} vérifications OK (${scenario})`);
      process.exit(ko ? 1 : 0);
    },
  };
}

// ── Navigateur ───────────────────────────────────────────────────────────────

/** Google Chrome installé (canal « chrome »), ou le binaire indiqué par E2E_CHROME. */
export function lancerNavigateur() {
  return chromium.launch({
    headless: true,
    ...(process.env.E2E_CHROME ? { executablePath: process.env.E2E_CHROME } : { channel: "chrome" }),
  });
}

/** Ouvre un contexte neuf, se connecte et attend la page d'accueil du rôle. */
export async function connecter(navigateur, compte, { largeur = 1280, hauteur = 900, telechargements = false } = {}) {
  const contexte = await navigateur.newContext({
    acceptDownloads: telechargements,
    viewport: { width: largeur, height: hauteur },
  });
  const page = await contexte.newPage();
  page.erreursJs = [];
  page.on("pageerror", (e) => page.erreursJs.push(e.message));
  await page.goto(`${BASE}/login`);
  await page.fill("#email", compte.email);
  await page.fill("#password", compte.motDePasse);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
  await page.waitForLoadState("networkidle");
  return page;
}

/** Va sur une page et attend que le contenu (et non le squelette de chargement) soit affiché. */
export async function ouvrir(page, chemin, attendre = "main h1") {
  await page.goto(`${BASE}${chemin}`);
  await page.waitForLoadState("networkidle");
  await page.locator(attendre).first().waitFor({ timeout: 30000 });
}

/** GET JSON exécuté dans la page, avec la session de l'utilisateur connecté. */
export function getJson(page, url) {
  return page.evaluate(async (u) => {
    const r = await fetch(u);
    return { status: r.status, corps: r.headers.get("content-type")?.includes("json") ? await r.json() : null };
  }, url);
}

export const statut = (page, url) => page.evaluate(async (u) => (await fetch(u)).status, url);

export function dossierResultats(...sousDossiers) {
  const dossier = path.join(DOSSIER_RESULTATS, ...sousDossiers);
  mkdirSync(dossier, { recursive: true });
  return dossier;
}

export const AUJOURDHUI = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(new Date());
