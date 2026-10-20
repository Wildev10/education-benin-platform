// npm run e2e : build, `next start` sur le port 3100, scénarios navigateur, arrêt du serveur.
//
//   npm run e2e                         tous les scénarios
//   npm run e2e -- pagination excel     seulement ceux-là
//   npm run e2e -- --sans-build         réutilise le build existant (.next)
//
// Le garde-fou de commun.mjs s'exécute à l'import : rien ne démarre (ni build,
// ni serveur) si la base du .env est protégée.
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { BASE, HOTE_BASE, PORT, RACINE, dossierResultats } from "./commun.mjs";

const SCENARIOS = ["connexions", "excel", "pagination", "finitions", "notifications", "langues", "droits", "fuseaux"];
const NEXT = path.join(RACINE, "node_modules", "next", "dist", "bin", "next");

const args = process.argv.slice(2);
const sansBuild = args.includes("--sans-build");
const demandes = args.filter((a) => !a.startsWith("--"));
const inconnus = demandes.filter((s) => !SCENARIOS.includes(s));
if (inconnus.length) {
  console.error(`Scénario inconnu : ${inconnus.join(", ")}. Disponibles : ${SCENARIOS.join(", ")}.`);
  process.exit(2);
}
const aLancer = demandes.length ? demandes : SCENARIOS;

function executer(commande, parametres, options = {}) {
  return new Promise((resolve) => {
    const enfant = spawn(commande, parametres, { cwd: RACINE, stdio: "inherit", ...options });
    enfant.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

async function repond() {
  try {
    await fetch(`${BASE}/login`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

console.log(`Base de données : ${HOTE_BASE} (non protégée)`);

if (await repond()) {
  console.error(`Le port ${PORT} est déjà utilisé : arrêtez le serveur qui l'occupe avant de lancer les tests.`);
  process.exit(1);
}

if (!sansBuild) {
  console.log("\n▶ npm run build");
  const code = await executer(process.execPath, [NEXT, "build"]);
  if (code !== 0) {
    console.error("Le build a échoué : tests non lancés.");
    process.exit(code);
  }
}

// ── Serveur ──────────────────────────────────────────────────────────────────

const journal = path.join(dossierResultats(), "serveur.log");
const sortie = createWriteStream(journal);
console.log(`\n▶ next start -p ${PORT} (journal : ${path.relative(RACINE, journal)})`);
// AUTH_TRUST_HOST : Auth.js refuse sinon les requêtes sur un hôte local avec `next start`
const serveur = spawn(process.execPath, [NEXT, "start", "-p", String(PORT)], {
  cwd: RACINE,
  env: { ...process.env, AUTH_TRUST_HOST: "true" },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true, // groupe de processus à part, arrêté d'un bloc
});
serveur.stdout.pipe(sortie);
serveur.stderr.pipe(sortie);

let arrete = false;
async function arreterServeur() {
  if (arrete) return;
  arrete = true;
  const fin = new Promise((resolve) => (serveur.exitCode !== null ? resolve() : serveur.once("exit", resolve)));
  try {
    process.kill(-serveur.pid, "SIGTERM");
  } catch {
    // déjà arrêté
  }
  const delai = setTimeout(() => {
    try {
      process.kill(-serveur.pid, "SIGKILL");
    } catch {
      // déjà arrêté
    }
  }, 10000);
  await fin;
  clearTimeout(delai);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await arreterServeur();
    process.exit(130);
  });
}

let pret = false;
for (let i = 0; i < 90 && serveur.exitCode === null; i++) {
  if (await repond()) {
    pret = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 1000));
}

// ── Scénarios ────────────────────────────────────────────────────────────────

const bilan = [];
if (!pret) {
  console.error(`Le serveur n'a pas démarré : voir ${journal}`);
} else {
  for (const scenario of aLancer) {
    const code = await executer(process.execPath, [path.join(RACINE, "e2e", `${scenario}.mjs`)], {
      env: { ...process.env, E2E_BASE_URL: BASE },
    });
    bilan.push({ scenario, ok: code === 0 });
  }
}

await arreterServeur();
sortie.end();

console.log("\n── Bilan ─────────────────────────────────────────────────────");
for (const { scenario, ok } of bilan) console.log(`${ok ? "✅" : "❌"} ${scenario}`);
console.log(`Serveur arrêté (port ${PORT}).`);
process.exit(pret && bilan.every((b) => b.ok) ? 0 : 1);
