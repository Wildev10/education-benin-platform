import "dotenv/config";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import readline from "node:readline";
import pg from "pg";
import { controlerConnexion, masquer, nettoyerSaisie } from "./seed-prod-outils";

// Relance du seed de démonstration en PRODUCTION, à lancer par le développeur :
//   npm run seed:prod
//
// 1. Chaîne de connexion de production collée en saisie masquée : jamais
//    affichée, jamais écrite sur le disque ni passée en argument ; transmise
//    aux étapes suivantes par leur seul environnement (DATABASE_URL).
// 2. Hôte vérifié dans PROTECTED_DB_HOSTS du .env (une variable déjà exportée
//    l'emporte sur le .env, comme pour tous les scripts) ; sinon arrêt.
// 3. Simulation du seed, sortie affichée avec le mot de passe masqué (***).
// 4. « OUI » en toutes lettres pour exécuter ; toute autre réponse arrête.
// 5. Seed exécuté (--execute --hote --autoriser-prod), puis recalcul des
//    alertes en simulation (lecture seule) et volumes du suivi.

const RACINE = path.resolve(import.meta.dirname, "..");
const TSX = path.join(RACINE, "node_modules", ".bin", "tsx");

// Neon : plusieurs adresses IP par hôte ; 250 ms par adresse ne suffisent pas
if (net.getDefaultAutoSelectFamilyAttemptTimeout() < 2000) net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

// ── Saisie ───────────────────────────────────────────────────────────────────

// Hors terminal (entrée redirigée, tests) : une seule lecture ligne à ligne pour tout le script
let lignesEntree: AsyncIterator<string> | null = null;
async function lireLigneRedirigee(): Promise<string> {
  lignesEntree ??= readline.createInterface({ input: process.stdin })[Symbol.asyncIterator]();
  const { value, done } = await lignesEntree.next();
  return done ? "" : value;
}

/** Saisie sans écho : rien ne s'affiche, ni les caractères ni leur nombre. */
function lireMasque(question: string): Promise<string> {
  process.stdout.write(question);
  if (!process.stdin.isTTY) {
    return lireLigneRedirigee().then((ligne) => {
      process.stdout.write("\n");
      return ligne;
    });
  }
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let saisie = "";
    const terminer = (erreur?: Error) => {
      stdin.off("data", surDonnees);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      if (erreur) reject(erreur);
      else resolve(saisie);
    };
    const surDonnees = (bloc: string) => {
      for (const c of bloc.replace(/\u001b\[20[01]~/g, "")) {
        if (c === "\r" || c === "\n") return terminer();
        if (c === "\u0003" || c === "\u0004") return terminer(new Error("Saisie annulée : rien n'a été lancé."));
        if (c === "\u007f" || c === "\b") saisie = saisie.slice(0, -1);
        else if (c >= " ") saisie += c;
      }
    };
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", surDonnees);
  });
}

/** Saisie visible (réponse OUI). */
async function lireVisible(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    process.stdout.write(question);
    const ligne = await lireLigneRedirigee();
    process.stdout.write(`${ligne}\n`);
    return ligne;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise((resolve) => rl.question(question, resolve));
  } finally {
    rl.close();
  }
}

// ── Étapes ───────────────────────────────────────────────────────────────────

/** Lance un script prisma/ avec la connexion de production dans son seul environnement ; sortie masquée. */
function lancer(script: string, args: string[], databaseUrl: string, secrets: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const enfant = spawn(TSX, [path.join("prisma", script), ...args], {
      cwd: RACINE,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const [flux, sortie] of [[enfant.stdout, process.stdout], [enfant.stderr, process.stderr]] as const) {
      readline.createInterface({ input: flux }).on("line", (ligne) => sortie.write(`${masquer(ligne, secrets)}\n`));
    }
    enfant.on("error", reject);
    enfant.on("close", (code) => resolve(code ?? 1));
  });
}

/** Volumes du suivi des alertes, en lecture seule. */
async function volumesSuivi(databaseUrl: string) {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 15000 });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const { rows } = await client.query<{ nouvelles: string; en_suivi: string; resolues: string; etapes: string }>(`
      SELECT count(*) FILTER (WHERE statut = 'active' AND "suiviDepuis" IS NULL)     AS nouvelles,
             count(*) FILTER (WHERE statut = 'active' AND "suiviDepuis" IS NOT NULL) AS en_suivi,
             count(*) FILTER (WHERE statut = 'traitee')                              AS resolues,
             (SELECT count(*) FROM "SuiviAlerte")                                    AS etapes
      FROM "Alerte"`);
    await client.query("ROLLBACK");
    return rows[0];
  } finally {
    await client.end();
  }
}

/** Secrets de la chaîne saisie, masqués dans toute sortie, erreurs comprises. */
let secretsConnus: string[] = [];

function arreter(message: string): never {
  console.error(`\n⛔  ${message}`);
  process.exit(1);
}

// ── Déroulé ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seed de démonstration en PRODUCTION : remplace toutes les données de démonstration.\n");

  const saisie = nettoyerSaisie(await lireMasque("Collez la chaîne de connexion de production (saisie masquée), puis Entrée : "));
  if (!saisie) arreter("Aucune chaîne saisie : rien n'a été lancé.");

  const controle = controlerConnexion(saisie, process.env.PROTECTED_DB_HOSTS);
  if (!controle.ok) arreter(controle.message);
  const { hote, secrets } = controle;
  secretsConnus = secrets;
  console.log(`Hôte reconnu dans PROTECTED_DB_HOSTS : ${hote}\n`);

  console.log("── 1/3 Simulation (rien n'est écrit) ──────────────────────────────\n");
  if ((await lancer("seed.ts", ["--autoriser-prod"], saisie, secrets)) !== 0) {
    arreter("La simulation a échoué : rien n'a été écrit.");
  }

  const reponse = await lireVisible(`\nTapez OUI pour remplacer les données de démonstration sur ${hote} : `);
  if (reponse.trim() !== "OUI") arreter("Réponse différente de « OUI » : rien n'a été écrit.");

  console.log("\n── 2/3 Exécution ──────────────────────────────────────────────────\n");
  if ((await lancer("seed.ts", ["--execute", `--hote=${hote}`, "--autoriser-prod"], saisie, secrets)) !== 0) {
    arreter("L'exécution a échoué. Le seed s'exécute en une seule transaction : en cas d'erreur, rien n'a été modifié.");
  }

  console.log("\n── 3/3 Vérification (lecture seule) ───────────────────────────────\n");
  // Sans --execute, recalculer-alertes ne fait que simuler la détection : attendu, rien à créer ni à mettre à jour
  if ((await lancer("recalculer-alertes.ts", [], saisie, secrets)) !== 0) {
    arreter("La vérification des alertes a échoué (les données du seed sont en place).");
  }
  const v = await volumesSuivi(saisie);
  console.log(
    `\nSuivi des alertes : ${v.en_suivi} en cours de suivi, ${v.resolues} résolue(s), ${v.nouvelles} nouvelle(s), ${v.etapes} étape(s) d'historique.`
  );
  console.log("Reconnectez chaque compte de démonstration : la session garde l'ancien établissement jusqu'à la reconnexion.");
}

main().catch((erreur: unknown) => {
  // Le message d'une erreur de connexion peut citer la chaîne : toujours masqué
  const texte = erreur instanceof Error ? erreur.message : String(erreur);
  arreter(masquer(texte, secretsConnus));
});
