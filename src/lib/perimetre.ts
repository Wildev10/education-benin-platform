import { NextResponse } from "next/server";

/**
 * Cloisonnement des données par rôle, vérifié côté serveur :
 * - admin : tout ;
 * - enseignant et directeur : uniquement les élèves de leur établissement
 *   (aucun s'ils n'en ont pas) ;
 * - étudiant : uniquement sa propre fiche.
 */

type Utilisateur = {
  role: string;
  etablissementId: string | null;
  etudiantId: string | null;
};

const ROLES_ETABLISSEMENT = new Set(["enseignant", "directeur"]);

/** Rôles autorisés à marquer une alerte comme traitée (le directeur consulte seulement). */
export const ROLES_TRAITEMENT_ALERTES = ["admin", "enseignant"];

export function peutTraiterAlertes(role: string | undefined): boolean {
  return !!role && ROLES_TRAITEMENT_ALERTES.includes(role);
}

/** L'utilisateur peut-il lire ou modifier les données de cet élève ? */
export function peutAccederEtudiant(
  user: Utilisateur,
  etudiant: { id: string; etablissementId: string }
): boolean {
  if (user.role === "admin") return true;
  if (ROLES_ETABLISSEMENT.has(user.role)) {
    return !!user.etablissementId && user.etablissementId === etudiant.etablissementId;
  }
  if (user.role === "etudiant") return !!user.etudiantId && user.etudiantId === etudiant.id;
  return false;
}

/** L'utilisateur peut-il consulter les données de tout cet établissement ? */
export function peutAccederEtablissement(user: Utilisateur, etablissementId: string): boolean {
  if (user.role === "admin") return true;
  if (ROLES_ETABLISSEMENT.has(user.role)) {
    return !!user.etablissementId && user.etablissementId === etablissementId;
  }
  return false;
}

/**
 * Restriction à ajouter sur `etudiant` dans une requête de liste.
 * {} = aucune restriction, null = aucun résultat possible.
 */
export function filtreEtudiantsAccessibles(user: Utilisateur): { etablissementId?: string; id?: string } | null {
  if (user.role === "admin") return {};
  if (ROLES_ETABLISSEMENT.has(user.role)) {
    return user.etablissementId ? { etablissementId: user.etablissementId } : null;
  }
  if (user.role === "etudiant") return user.etudiantId ? { id: user.etudiantId } : null;
  return null;
}

/**
 * Réponse pour une ressource absente ou hors périmètre : on renvoie 404 dans
 * les deux cas pour ne pas révéler l'existence d'une ressource d'un autre
 * établissement.
 */
export function introuvable(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}
