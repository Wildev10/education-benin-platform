import { prisma } from "@/lib/prisma";

export type TypeRequete = "etudiants" | "alertes" | "absences" | "inconnu";
export type Regroupement = "etablissement" | "niveau";

export type Filtres = {
  etablissement?: string;
  departement?: string;
  commune?: string;
  niveau?: string;
  periode?: string;
  niveauRisque?: "moyen" | "eleve";
  statutAlerte?: "active" | "traitee";
  motifAbsence?: "injustifiee" | "justifiee";
};

export type Requete = {
  type: TypeRequete;
  filtres: Filtres;
  regrouperPar?: Regroupement;
  // Valeurs proposées (par l'IA) qui ne figurent pas dans la liste blanche.
  valeursInconnues: string[];
};

// Listes blanches lues en base : seules ces valeurs peuvent atteindre Prisma.
export type Referentiel = {
  etablissements: string[];
  departements: string[];
  communes: string[];
  niveaux: string[];
  periodes: string[];
};

export const exemplesQuestions = [
  "Combien d'étudiants en Terminale D ?",
  "Liste les alertes actives à Cotonou",
  "Répartition des étudiants par établissement",
  "Combien d'absences injustifiées ce trimestre ?",
];

export async function chargerReferentiel(): Promise<Referentiel> {
  const [etablissements, niveaux] = await Promise.all([
    prisma.etablissement.findMany({
      select: { nom: true, departement: true, commune: true },
    }),
    prisma.etudiant.findMany({ select: { niveau: true }, distinct: ["niveau"] }),
  ]);

  return {
    etablissements: unique(etablissements.map((e) => e.nom)),
    departements: unique(etablissements.map((e) => e.departement)),
    communes: unique(etablissements.map((e) => e.commune)),
    niveaux: unique(niveaux.map((n) => n.niveau)),
    periodes: ["Trimestre 1", "Trimestre 2", "Trimestre 3"],
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "fr"));
}

// Minuscules, sans accents ni ponctuation : "Lycée Mathieu-Bouké" -> "lycee mathieu bouke".
export function normaliser(texte: string) {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function trouverDansListe(valeur: string, liste: string[]) {
  const cible = normaliser(valeur);
  return liste.find((element) => normaliser(element) === cible) ?? null;
}

/**
 * Transforme la sortie brute de l'IA en requête sûre : chaque valeur doit
 * exister dans le référentiel, sinon elle est signalée dans valeursInconnues
 * (jamais ignorée en silence, sous peine de répondre à une question plus large).
 */
export function validerRequete(brut: unknown, ref: Referentiel): Requete {
  const vide: Requete = { type: "inconnu", filtres: {}, valeursInconnues: [] };
  if (!brut || typeof brut !== "object") return vide;

  const candidat = brut as {
    type?: unknown;
    filtres?: unknown;
    regrouperPar?: unknown;
  };
  if (candidat.type !== "etudiants" && candidat.type !== "alertes" && candidat.type !== "absences") return vide;

  const requete: Requete = {
    type: candidat.type,
    filtres: {},
    valeursInconnues: [],
  };
  if (candidat.regrouperPar === "etablissement" || candidat.regrouperPar === "niveau") {
    requete.regrouperPar = candidat.regrouperPar;
  }

  const filtres =
    candidat.filtres && typeof candidat.filtres === "object"
      ? (candidat.filtres as Record<string, unknown>)
      : {};

  const listes = {
    etablissement: ref.etablissements,
    departement: ref.departements,
    commune: ref.communes,
    niveau: ref.niveaux,
    periode: ref.periodes,
  } as const;

  for (const champ of Object.keys(listes) as Array<keyof typeof listes>) {
    const valeur = filtres[champ];
    if (typeof valeur !== "string" || !valeur.trim()) continue;
    const canonique = trouverDansListe(valeur, listes[champ]);
    if (canonique) requete.filtres[champ] = canonique;
    else requete.valeursInconnues.push(`${champ} « ${valeur.trim()} »`);
  }

  // Les filtres propres aux alertes sont ignorés pour les étudiants.
  if (requete.type === "alertes") {
    if (filtres.niveauRisque === "moyen" || filtres.niveauRisque === "eleve") {
      requete.filtres.niveauRisque = filtres.niveauRisque;
    }
    if (filtres.statutAlerte === "active" || filtres.statutAlerte === "traitee") {
      requete.filtres.statutAlerte = filtres.statutAlerte;
    }
  }
  // Les filtres propres aux absences.
  if (requete.type === "absences") {
    if (filtres.motifAbsence === "injustifiee" || filtres.motifAbsence === "justifiee") {
      requete.filtres.motifAbsence = filtres.motifAbsence;
    }
  }

  return requete;
}
