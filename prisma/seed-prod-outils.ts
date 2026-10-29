import { hoteProtegeCorrespondant, listeHotesProteges } from "./garde-prod";

/**
 * Outils purs de prisma/seed-prod.ts (testés dans src/__tests__/seed-prod.test.ts) :
 * contrôle de la chaîne collée et masquage des secrets dans tout ce qui s'affiche.
 */

export type ControleConnexion =
  | { ok: true; hote: string; secrets: string[] }
  | { ok: false; message: string };

/**
 * La chaîne doit être une URL PostgreSQL dont l'hôte figure dans
 * PROTECTED_DB_HOSTS (même règle que prisma/garde-prod.ts). Le message
 * d'erreur ne reprend jamais la chaîne, seulement l'hôte.
 */
export function controlerConnexion(saisie: string, hostsProtegees: string | undefined): ControleConnexion {
  const chaine = saisie.trim();
  let url: URL;
  try {
    url = new URL(chaine);
  } catch {
    return { ok: false, message: "Chaîne de connexion illisible (attendu : postgresql://…) : rien n'a été lancé." };
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    return { ok: false, message: "Ce n'est pas une chaîne PostgreSQL (postgresql://…) : rien n'a été lancé." };
  }
  if (!url.hostname) return { ok: false, message: "Aucun hôte dans la chaîne de connexion : rien n'a été lancé." };

  const hotes = listeHotesProteges(hostsProtegees);
  if (hotes.length === 0) {
    return { ok: false, message: "PROTECTED_DB_HOSTS est vide ou absente du .env : impossible de reconnaître la production, rien n'a été lancé." };
  }
  if (!hoteProtegeCorrespondant(chaine, hotes)) {
    return {
      ok: false,
      message: `L'hôte ${url.hostname} ne figure pas dans PROTECTED_DB_HOSTS : ce n'est pas la base de production attendue, rien n'a été lancé.`,
    };
  }
  return { ok: true, hote: url.hostname, secrets: secretsDe(chaine, url) };
}

/** La chaîne entière et le mot de passe, sous ses formes encodée et décodée. */
function secretsDe(chaine: string, url: URL): string[] {
  const secrets = [chaine];
  if (url.password) {
    secrets.push(url.password);
    try {
      secrets.push(decodeURIComponent(url.password));
    } catch {
      // mot de passe mal encodé : la forme brute suffit
    }
  }
  // Les plus longs d'abord : la chaîne entière avant le mot de passe qu'elle contient
  return [...new Set(secrets.filter(Boolean))].sort((a, b) => b.length - a.length);
}

/** Remplace chaque secret par *** dans une ligne avant de l'afficher. */
export function masquer(ligne: string, secrets: string[]): string {
  let resultat = ligne;
  for (const secret of secrets) resultat = resultat.split(secret).join("***");
  return resultat;
}

/** Retire les marqueurs de collage (bracketed paste) et le retour chariot d'une saisie. */
export function nettoyerSaisie(saisie: string): string {
  return saisie.replace(/\u001b\[20[01]~/g, "").replace(/\r/g, "").trim();
}
