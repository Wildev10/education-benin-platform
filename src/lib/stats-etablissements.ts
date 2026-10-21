import { prisma } from "@/lib/prisma";

type AlerteActive = { niveauRisque: string; etudiant: { etablissementId: string } };

/**
 * Statistiques par établissement. `alertesActives` : les alertes actives déjà
 * chargées par l'appelant (tableau de bord), pour ne pas les relire en base.
 */
export async function getStatsEtablissements(alertesActives?: Promise<AlerteActive[]>) {
  const [etablissements, alertes, moyennesParEtudiant] = await Promise.all([
    prisma.etablissement.findMany({
      select: {
        id: true,
        nom: true,
        departement: true,
        etudiants: { select: { id: true } },
      },
    }),
    alertesActives ??
      prisma.alerte.findMany({
        where: { statut: "active" },
        select: { niveauRisque: true, etudiant: { select: { etablissementId: true } } },
      }),
    prisma.note.groupBy({ by: ["etudiantId", "anneeScolaire"], _avg: { valeur: true } }),
  ]);

  // Moyenne de chaque élève pour chaque année scolaire
  const moyennesEtudiant = new Map<string, Map<string, number>>();
  for (const m of moyennesParEtudiant) {
    if (m._avg.valeur === null) continue;
    const parAnnee = moyennesEtudiant.get(m.etudiantId) ?? new Map<string, number>();
    parAnnee.set(m.anneeScolaire, m._avg.valeur);
    moyennesEtudiant.set(m.etudiantId, parAnnee);
  }

  return etablissements
    .map(({ etudiants, ...etablissement }) => {
      const alertesEtab = alertes.filter((a) => a.etudiant.etablissementId === etablissement.id);
      // Année la plus récente de l'établissement, comme le tableau de bord du
      // directeur : deux années ne sont jamais mélangées dans une moyenne
      const anneeMoyenne =
        etudiants.flatMap((e) => [...(moyennesEtudiant.get(e.id)?.keys() ?? [])]).sort().at(-1) ?? null;
      const moyennes = etudiants
        .map((e) => (anneeMoyenne ? moyennesEtudiant.get(e.id)?.get(anneeMoyenne) : undefined))
        .filter((m): m is number => typeof m === "number");
      const nbEtudiants = etudiants.length;

      return {
        ...etablissement,
        nbEtudiants,
        nbAlertesActives: alertesEtab.length,
        nbAlertesElevees: alertesEtab.filter((a) => a.niveauRisque === "eleve").length,
        anneeMoyenne,
        moyenneGenerale: moyennes.length
          ? round(moyennes.reduce((s, m) => s + m, 0) / moyennes.length, 2)
          : null,
        tauxAlerte: nbEtudiants ? round((alertesEtab.length / nbEtudiants) * 100, 1) : 0,
      };
    })
    .sort((a, b) => b.tauxAlerte - a.tauxAlerte || b.nbAlertesActives - a.nbAlertesActives);
}

function round(value: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export type StatsEtablissement = Awaited<ReturnType<typeof getStatsEtablissements>>[number];
