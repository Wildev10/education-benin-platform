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

/** Suivi des alertes (POST /api/alertes/[id]/suivis) : l'établissement agit, l'admin consulte. */
export const ROLES_TRAITEMENT_ALERTES = ["enseignant", "directeur"];
/** Supprimer une absence (DELETE /api/absences/[id]) : le directeur saisit mais ne supprime pas. */
export const ROLES_SUPPRESSION_ABSENCE = ["admin", "enseignant"];
/** Importer des notes par fichier CSV (POST /api/notes/import). */
export const ROLES_IMPORT_NOTES = ["admin", "enseignant"];

/** L'interface n'affiche une action qu'aux rôles que l'API autorise : mêmes listes des deux côtés. */
export function peutSupprimerAbsence(role: string | undefined): boolean {
  return !!role && ROLES_SUPPRESSION_ABSENCE.includes(role);
}

export function peutImporterNotes(role: string | undefined): boolean {
  return !!role && ROLES_IMPORT_NOTES.includes(role);
}

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
