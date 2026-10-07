/**
 * Garde-fou production : bloque tout script qui tenterait d'écrire sur la base
 * de production par erreur. Appeler verifierBaseNonProtegee() en tout début de
 * script d'écriture.
 *
 * Pour passer outre (uniquement en connaissance de cause) :
 *   npx tsx prisma/mon-script.ts --autoriser-prod
 */

import "dotenv/config";
import { URL } from "node:url";

export function verifierBaseNonProtegee(): void {
  const databaseUrl = process.env.DATABASE_URL;
  const hostsProtegees = process.env.PROTECTED_DB_HOSTS ?? "";

  if (!databaseUrl) {
    console.error("DATABASE_URL non définie — script bloqué.");
    process.exit(1);
  }

  // --autoriser-prod désactive explicitement le garde-fou
  if (process.argv.includes("--autoriser-prod")) return;

  const hotes = hostsProtegees
    .split(",")
    .map((h) => h.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);

  if (hotes.length === 0) return; // PROTECTED_DB_HOSTS vide → aucune restriction

  let hoteConnexion: string;
  try {
    hoteConnexion = new URL(databaseUrl).hostname;
  } catch {
    // URL non parseable (format pooler avec paramètres) : recherche brute
    hoteConnexion = databaseUrl;
  }

  for (const hote of hotes) {
    if (hoteConnexion.includes(hote)) {
      console.error(
        `\n⛔  Base de PRODUCTION détectée (${hote}), script bloqué.\n` +
          "    Utilisez une base de développement.\n" +
          "    Pour forcer l'exécution (en connaissance de cause) : --autoriser-prod\n"
      );
      process.exit(1);
    }
  }
}
