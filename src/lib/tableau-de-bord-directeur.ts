import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

// ── Accès ────────────────────────────────────────────────────────────────────

export type AccesDirecteur =
  | { statut: "non-connecte" }
  | { statut: "interdit" }
  | { statut: "sans-etablissement" }
  | { statut: "ok"; etablissementId: string };

/** Le tableau de bord directeur est réservé au rôle directeur rattaché à un établissement. */
export function resoudreAccesDirecteur(session: Session | null): AccesDirecteur {
  if (!session?.user) return { statut: "non-connecte" };
  if (session.user.role !== "directeur") return { statut: "interdit" };
  if (!session.user.etablissementId) return { statut: "sans-etablissement" };
  return { statut: "ok", etablissementId: session.user.etablissementId };
}

// ── Données ──────────────────────────────────────────────────────────────────

const ordrePeriodes: Record<string, number> = {
  "Trimestre 1": 1,
  "Trimestre 2": 2,
  "Trimestre 3": 3,
};

const ordreNiveaux = ["6ème", "5ème", "4ème", "3ème", "Seconde", "Première", "Terminale"];

function rangNiveau(niveau: string) {
  const i = ordreNiveaux.findIndex((n) => niveau.startsWith(n));
  return i === -1 ? ordreNiveaux.length : i;
}

function arrondir(valeur: number, decimales = 2) {
  const f = 10 ** decimales;
  return Math.round(valeur * f) / f;
}

export type PointEvolution = { periode: string; moyenne: number };
export type MoyenneNiveau = { niveau: string; moyenne: number; eleves: number };

export type EleveARisque = {
  alerteId: string;
  etudiantId: string;
  nom: string;
  prenom: string;
  niveau: string;
  niveauRisque: string;
  type: string;
  periode: string;
  moyenneApres: number;
  ecartPourcent: number;
};

export type AbsenceRecente = {
  id: string;
  date: string;
  periode: string;
  etudiant: { id: string; nom: string; prenom: string; niveau: string };
};

export type TableauDeBordDirecteur = {
  etablissement: { id: string; nom: string; departement: string; commune: string };
  anneeScolaire: string | null;
  nbEleves: number;
  moyenneGenerale: number | null;
  alertes: { total: number; eleve: number; moyen: number };
  nbElevesEnAlerte: number;
  tauxElevesEnAlerte: number;
  absencesInjustifieesMois: number;
  mois: string;
  evolution: PointEvolution[];
  moyennesParNiveau: MoyenneNiveau[];
  elevesARisque: EleveARisque[];
  dernieresAbsences: AbsenceRecente[];
};

/**
 * Agrège les indicateurs d'un établissement. Toutes les requêtes sont filtrées
 * sur etablissementId : rien ne doit fuiter d'un autre établissement.
 * Retourne null si l'établissement n'existe pas.
 */
export async function getTableauDeBordDirecteur(
  etablissementId: string,
  maintenant: Date = new Date()
): Promise<TableauDeBordDirecteur | null> {
  const ecole = { etudiant: { etablissementId } };
  const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  const debutMoisSuivant = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 1);
  const absencesInjustifiees = { ...ecole, motif: "injustifiee" };

  const [
    etablissement,
    eleves,
    alertesActives,
    notesParPeriode,
    notesParEleve,
    absencesInjustifieesMois,
    dernieresAbsences,
  ] = await Promise.all([
    prisma.etablissement.findUnique({
      where: { id: etablissementId },
      select: { id: true, nom: true, departement: true, commune: true },
    }),
    prisma.etudiant.findMany({
      where: { etablissementId },
      select: { id: true, niveau: true },
    }),
    prisma.alerte.findMany({
      where: { ...ecole, statut: "active" },
      select: {
        id: true,
        etudiantId: true,
        niveauRisque: true,
        type: true,
        periode: true,
        moyenneApres: true,
        ecartPourcent: true,
        createdAt: true,
        etudiant: { select: { nom: true, prenom: true, niveau: true } },
      },
    }),
    prisma.note.groupBy({
      by: ["anneeScolaire", "periode"],
      where: ecole,
      _sum: { valeur: true },
      _count: { valeur: true },
    }),
    prisma.note.groupBy({
      by: ["etudiantId", "anneeScolaire"],
      where: ecole,
      _sum: { valeur: true },
      _count: { valeur: true },
    }),
    prisma.absence.count({
      where: { ...absencesInjustifiees, date: { gte: debutMois, lt: debutMoisSuivant } },
    }),
    prisma.absence.findMany({
      where: absencesInjustifiees,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        date: true,
        periode: true,
        etudiant: { select: { id: true, nom: true, prenom: true, niveau: true } },
      },
    }),
  ]);

  if (!etablissement) return null;

  // Année scolaire de référence : la plus récente ayant des notes
  const annees = [...new Set(notesParPeriode.map((g) => g.anneeScolaire))].sort();
  const anneeScolaire = annees.at(-1) ?? null;
  const plusieursAnnees = annees.length > 1;

  const evolution = notesParPeriode
    .filter((g) => g._count.valeur > 0)
    .sort(
      (a, b) =>
        a.anneeScolaire.localeCompare(b.anneeScolaire) ||
        (ordrePeriodes[a.periode] ?? 99) - (ordrePeriodes[b.periode] ?? 99)
    )
    .map((g) => ({
      periode: plusieursAnnees ? `${g.periode} (${g.anneeScolaire})` : g.periode,
      moyenne: arrondir((g._sum.valeur ?? 0) / g._count.valeur),
    }));

  const groupesAnnee = notesParPeriode.filter((g) => g.anneeScolaire === anneeScolaire);
  const sommeAnnee = groupesAnnee.reduce((s, g) => s + (g._sum.valeur ?? 0), 0);
  const nbNotesAnnee = groupesAnnee.reduce((s, g) => s + g._count.valeur, 0);
  const moyenneGenerale = nbNotesAnnee > 0 ? arrondir(sommeAnnee / nbNotesAnnee) : null;

  // Moyennes par niveau (classe) sur l'année de référence
  const niveauParEleve = new Map(eleves.map((e) => [e.id, e.niveau]));
  const parNiveau = new Map<string, { somme: number; nb: number; eleves: Set<string> }>();
  for (const g of notesParEleve) {
    if (g.anneeScolaire !== anneeScolaire) continue;
    const niveau = niveauParEleve.get(g.etudiantId);
    if (!niveau) continue;
    const acc = parNiveau.get(niveau) ?? { somme: 0, nb: 0, eleves: new Set<string>() };
    acc.somme += g._sum.valeur ?? 0;
    acc.nb += g._count.valeur;
    acc.eleves.add(g.etudiantId);
    parNiveau.set(niveau, acc);
  }
  const moyennesParNiveau = [...parNiveau.entries()]
    .filter(([, acc]) => acc.nb > 0)
    .map(([niveau, acc]) => ({
      niveau,
      moyenne: arrondir(acc.somme / acc.nb),
      eleves: acc.eleves.size,
    }))
    .sort((a, b) => rangNiveau(a.niveau) - rangNiveau(b.niveau) || a.niveau.localeCompare(b.niveau));

  // Alertes actives
  const alertesEleve = alertesActives.filter((a) => a.niveauRisque === "eleve").length;
  const elevesEnAlerte = new Set(alertesActives.map((a) => a.etudiantId));
  const nbEleves = eleves.length;

  // 5 élèves les plus à risque : risque élevé d'abord, puis plus forte baisse, puis plus récente
  const vus = new Set<string>();
  const elevesARisque: EleveARisque[] = [];
  for (const a of [...alertesActives].sort(
    (x, y) =>
      (y.niveauRisque === "eleve" ? 1 : 0) - (x.niveauRisque === "eleve" ? 1 : 0) ||
      y.ecartPourcent - x.ecartPourcent ||
      y.createdAt.getTime() - x.createdAt.getTime()
  )) {
    if (vus.has(a.etudiantId)) continue;
    vus.add(a.etudiantId);
    elevesARisque.push({
      alerteId: a.id,
      etudiantId: a.etudiantId,
      nom: a.etudiant.nom,
      prenom: a.etudiant.prenom,
      niveau: a.etudiant.niveau,
      niveauRisque: a.niveauRisque,
      type: a.type,
      periode: a.periode,
      moyenneApres: a.moyenneApres,
      ecartPourcent: arrondir(a.ecartPourcent, 1),
    });
    if (elevesARisque.length === 5) break;
  }

  return {
    etablissement,
    anneeScolaire,
    nbEleves,
    moyenneGenerale,
    alertes: {
      total: alertesActives.length,
      eleve: alertesEleve,
      moyen: alertesActives.length - alertesEleve,
    },
    nbElevesEnAlerte: elevesEnAlerte.size,
    tauxElevesEnAlerte: nbEleves > 0 ? arrondir((elevesEnAlerte.size / nbEleves) * 100, 1) : 0,
    absencesInjustifieesMois,
    mois: maintenant.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    evolution,
    moyennesParNiveau,
    elevesARisque,
    dernieresAbsences: dernieresAbsences.map((a) => ({
      id: a.id,
      date: a.date.toISOString(),
      periode: a.periode,
      etudiant: a.etudiant,
    })),
  };
}
