import type { Prisma } from "@/generated/prisma/client";

// Ce module n'importe Prisma qu'en type : il est utilisé côté client (formulaire
// de filtres) comme côté serveur (page, API, export PDF).

export type FiltreNiveau = "eleve" | "moyen";
export type FiltreType = "notes" | "absences";
export type FiltreStatut = "active" | "traitee" | "toutes";

export type FiltresAlertes = {
  niveau?: FiltreNiveau;
  type?: FiltreType;
  statut: FiltreStatut;
  /** Date de création minimale, AAAA-MM-JJ (incluse) */
  du?: string;
  /** Date de création maximale, AAAA-MM-JJ (incluse) */
  au?: string;
  /** Réservé à l'admin : ignoré pour les autres rôles */
  etablissement?: string;
  /** Recherche sur le nom ou le prénom de l'élève */
  q?: string;
};

export const STATUT_PAR_DEFAUT: FiltreStatut = "active";

/** Valeur de `type` en base pour chaque filtre de l'interface. */
const typeEnBase: Record<FiltreType, string> = {
  notes: "baisse_moyenne",
  absences: "absences",
};

// Le Bénin est à UTC+1 toute l'année : une journée va de 00:00 à 24:00 heure de Porto-Novo.
const DECALAGE_BENIN = "+01:00";

type ParamsEntree = URLSearchParams | Record<string, string | string[] | undefined>;

function lire(params: ParamsEntree, cle: string): string | undefined {
  const brut = params instanceof URLSearchParams ? params.get(cle) : params[cle];
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  const nettoye = valeur?.trim();
  return nettoye ? nettoye : undefined;
}

function dateValide(valeur: string | undefined): string | undefined {
  if (!valeur || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return undefined;
  const d = new Date(`${valeur}T00:00:00Z`);
  // Rejette les dates impossibles (2026-02-31…)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(valeur) ? valeur : undefined;
}

/** Lit les filtres depuis l'URL. Les valeurs inconnues ou mal formées sont ignorées. */
export function lireFiltres(params: ParamsEntree): FiltresAlertes {
  const niveau = lire(params, "niveau") ?? lire(params, "niveauRisque");
  const type = lire(params, "type");
  const statut = lire(params, "statut");
  const q = lire(params, "q")?.slice(0, 100);

  return {
    niveau: niveau === "eleve" || niveau === "moyen" ? niveau : undefined,
    type: type === "notes" || type === "absences" ? type : undefined,
    statut: statut === "active" || statut === "traitee" || statut === "toutes" ? statut : STATUT_PAR_DEFAUT,
    du: dateValide(lire(params, "du")),
    au: dateValide(lire(params, "au")),
    etablissement: lire(params, "etablissement"),
    q,
  };
}

/** Sérialise les filtres pour l'URL, sans les valeurs par défaut. */
export function filtresVersParams(filtres: FiltresAlertes): URLSearchParams {
  const params = new URLSearchParams();
  if (filtres.niveau) params.set("niveau", filtres.niveau);
  if (filtres.type) params.set("type", filtres.type);
  if (filtres.statut !== STATUT_PAR_DEFAUT) params.set("statut", filtres.statut);
  if (filtres.du) params.set("du", filtres.du);
  if (filtres.au) params.set("au", filtres.au);
  if (filtres.etablissement) params.set("etablissement", filtres.etablissement);
  if (filtres.q) params.set("q", filtres.q);
  return params;
}

export function compterFiltresActifs(filtres: FiltresAlertes): number {
  return [...filtresVersParams(filtres).keys()].length;
}

export function periodeIncoherente(filtres: FiltresAlertes): boolean {
  return !!filtres.du && !!filtres.au && filtres.du > filtres.au;
}

// ── Périmètre selon le rôle ──────────────────────────────────────────────────

export type PorteeAlertes =
  | { type: "toutes" }
  | { type: "etablissement"; etablissementId: string }
  | { type: "aucune" };

/**
 * Ce que l'utilisateur a le droit de voir, indépendamment de l'URL :
 * l'admin voit tout, directeur et enseignant uniquement leur établissement,
 * et personne d'autre ne voit rien (y compris un directeur sans établissement).
 */
export function porteeAlertes(user: { role: string; etablissementId: string | null }): PorteeAlertes {
  if (user.role === "admin") return { type: "toutes" };
  if ((user.role === "directeur" || user.role === "enseignant") && user.etablissementId) {
    return { type: "etablissement", etablissementId: user.etablissementId };
  }
  return { type: "aucune" };
}

// ── Construction de la requête ───────────────────────────────────────────────

/**
 * Traduit les filtres en clause Prisma. Le périmètre du rôle est appliqué en
 * dernier et l'emporte toujours sur le filtre établissement de l'URL.
 * Retourne null quand aucun résultat n'est possible.
 */
export function construireWhereAlertes(
  filtres: FiltresAlertes,
  portee: PorteeAlertes
): Prisma.AlerteWhereInput | null {
  if (portee.type === "aucune") return null;

  const where: Prisma.AlerteWhereInput = {};
  const etudiant: Prisma.EtudiantWhereInput = {};

  if (filtres.statut !== "toutes") where.statut = filtres.statut;
  if (filtres.niveau) where.niveauRisque = filtres.niveau;
  if (filtres.type) where.type = typeEnBase[filtres.type];

  if (filtres.du || filtres.au) {
    where.createdAt = {
      ...(filtres.du ? { gte: new Date(`${filtres.du}T00:00:00${DECALAGE_BENIN}`) } : {}),
      ...(filtres.au ? { lte: new Date(`${filtres.au}T23:59:59.999${DECALAGE_BENIN}`) } : {}),
    };
  }

  const mots = filtres.q?.split(/\s+/).filter(Boolean) ?? [];
  if (mots.length > 0) {
    // Chaque mot doit se retrouver dans le nom ou le prénom (« koffi agossou » trouve Koffi Agossou)
    etudiant.AND = mots.map((mot) => ({
      OR: [
        { nom: { contains: mot, mode: "insensitive" as const } },
        { prenom: { contains: mot, mode: "insensitive" as const } },
      ],
    }));
  }

  if (portee.type === "etablissement") {
    etudiant.etablissementId = portee.etablissementId;
  } else if (filtres.etablissement) {
    etudiant.etablissementId = filtres.etablissement;
  }

  if (Object.keys(etudiant).length > 0) where.etudiant = etudiant;
  return where;
}

// ── Libellés ─────────────────────────────────────────────────────────────────

function formaterJour(iso: string) {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

/** Résumé lisible des filtres actifs (en-tête du PDF, annonces). */
export function decrireFiltres(filtres: FiltresAlertes, nomEtablissement?: string): string[] {
  const lignes: string[] = [];
  lignes.push(
    filtres.statut === "active" ? "Alertes actives" : filtres.statut === "traitee" ? "Alertes traitées" : "Tous statuts"
  );
  if (filtres.niveau) lignes.push(`Risque ${filtres.niveau === "eleve" ? "élevé" : "moyen"}`);
  if (filtres.type) lignes.push(filtres.type === "notes" ? "Type : notes" : "Type : absences");
  if (filtres.du && filtres.au) lignes.push(`Du ${formaterJour(filtres.du)} au ${formaterJour(filtres.au)}`);
  else if (filtres.du) lignes.push(`Depuis le ${formaterJour(filtres.du)}`);
  else if (filtres.au) lignes.push(`Jusqu'au ${formaterJour(filtres.au)}`);
  if (nomEtablissement) lignes.push(nomEtablissement);
  if (filtres.q) lignes.push(`Recherche « ${filtres.q} »`);
  return lignes;
}
