/**
 * Garde-fou production : bloque tout script qui tenterait d'écrire sur la base
 * de production par erreur. Appeler verifierBaseNonProtegee() en tout début de
 * script d'écriture.
 *
 * PROTECTED_DB_HOSTS (.env) liste les hôtes de production, séparés par des
 * virgules. Vide ou absente, rien ne permet de vérifier la base : le script
 * est bloqué.
 *
 * Pour passer outre (uniquement en connaissance de cause) :
 *   npx tsx prisma/mon-script.ts --autoriser-prod
 */

import "dotenv/config";
import { URL } from "node:url";

export type DiagnosticBase = { autorise: true } | { autorise: false; message: string };

/** Hôtes listés dans PROTECTED_DB_HOSTS (séparés par des virgules, guillemets tolérés). */
export function listeHotesProteges(hostsProtegees: string | undefined): string[] {
  return (hostsProtegees ?? "")
    .split(",")
    .map((h) => h.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/** L'entrée de la liste protégée qui correspond à cette connexion, ou null. */
export function hoteProtegeCorrespondant(databaseUrl: string, hotes: string[]): string | null {
  let hoteConnexion: string;
  try {
    hoteConnexion = new URL(databaseUrl).hostname;
  } catch {
    // URL non parseable (format pooler avec paramètres) : recherche brute
    hoteConnexion = databaseUrl;
  }
  return hotes.find((hote) => hoteConnexion.includes(hote)) ?? null;
}

/** Décide si un script peut écrire sur la base, sans rien arrêter (testable). */
export function diagnostiquerBase({
  databaseUrl,
  hostsProtegees,
  autoriserProd = false,
}: {
  databaseUrl: string | undefined;
  hostsProtegees: string | undefined;
  autoriserProd?: boolean;
}): DiagnosticBase {
  if (!databaseUrl) {
    return { autorise: false, message: "DATABASE_URL non définie — script bloqué." };
  }

  // --autoriser-prod désactive explicitement le garde-fou
  if (autoriserProd) return { autorise: true };

  const hotes = listeHotesProteges(hostsProtegees);

  if (hotes.length === 0) {
    return {
      autorise: false,
      message:
        "\n⛔  PROTECTED_DB_HOSTS est vide ou absente : impossible de vérifier que la base n'est pas celle de production, script bloqué.\n" +
        "    Ajoutez dans .env l'hôte de la base de production (plusieurs hôtes : séparés par des virgules).\n",
    };
  }

  const protegee = hoteProtegeCorrespondant(databaseUrl, hotes);
  if (protegee) {
    return {
      autorise: false,
      message:
        `\n⛔  Base de PRODUCTION détectée (${protegee}), script bloqué.\n` +
        "    Utilisez une base de développement.\n" +
        "    Pour forcer l'exécution (en connaissance de cause) : --autoriser-prod\n",
    };
  }

  return { autorise: true };
}

export function verifierBaseNonProtegee(): void {
  const diagnostic = diagnostiquerBase({
    databaseUrl: process.env.DATABASE_URL,
    hostsProtegees: process.env.PROTECTED_DB_HOSTS,
    autoriserProd: process.argv.includes("--autoriser-prod"),
  });
  if (!diagnostic.autorise) {
    console.error(diagnostic.message);
    process.exit(1);
  }
}
