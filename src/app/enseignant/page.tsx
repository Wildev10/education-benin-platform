import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/StatCard";
import StudentDirectory from "./StudentDirectory";

const TRIMESTRE_PAR_DEFAUT = "Trimestre 3";

async function getStatsEcole(etablissementId: string | null | undefined) {
  if (!etablissementId) {
    return { eleves: 0, alertesActives: 0, alertesEleve: 0, elevesEnAlerte: 0, absencesInjustifiees: 0, trimestre: TRIMESTRE_PAR_DEFAUT };
  }

  const ecole = { etudiant: { etablissementId } };

  const [eleves, alertesActives, alertesEleve, elevesEnAlerte, derniereAbsence] = await Promise.all([
    prisma.etudiant.count({ where: { etablissementId } }),
    prisma.alerte.count({ where: { ...ecole, statut: "active" } }),
    prisma.alerte.count({ where: { ...ecole, statut: "active", niveauRisque: "eleve" } }),
    prisma.alerte.findMany({
      where: { ...ecole, statut: "active" },
      distinct: ["etudiantId"],
      select: { etudiantId: true },
    }),
    prisma.absence.findFirst({
      where: ecole,
      orderBy: [{ anneeScolaire: "desc" }, { periode: "desc" }],
      select: { anneeScolaire: true, periode: true },
    }),
  ]);

  const absencesInjustifiees = derniereAbsence
    ? await prisma.absence.count({
        where: {
          ...ecole,
          motif: "injustifiee",
          anneeScolaire: derniereAbsence.anneeScolaire,
          periode: derniereAbsence.periode,
        },
      })
    : 0;

  return {
    eleves,
    alertesActives,
    alertesEleve,
    elevesEnAlerte: elevesEnAlerte.length,
    absencesInjustifiees,
    trimestre: derniereAbsence?.periode ?? TRIMESTRE_PAR_DEFAUT,
  };
}

export default async function EnseignantPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const stats = await getStatsEcole(session?.user?.etablissementId);

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">
          Tableau de bord
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Espace Enseignant
        </h1>
        <p className="mt-3 text-lg leading-8 text-ink-secondary">
          Consultez les élèves de vos établissements et suivez leurs résultats au fil des périodes.
        </p>
      </div>

      <section aria-label="Statistiques de mon école" className="mt-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Mes élèves" value={stats.eleves} />
          <StatCard
            label="Alertes actives"
            value={stats.alertesActives}
            tone={stats.alertesActives > 0 ? "brand" : "default"}
          />
          <StatCard
            label="Risque élevé"
            value={stats.alertesEleve}
            tone={stats.alertesEleve > 0 ? "danger" : "default"}
          />
          <StatCard
            label="Absences injustifiées"
            value={stats.absencesInjustifiees}
            sublabel={`ce trimestre (${stats.trimestre})`}
            tone={stats.absencesInjustifiees > 0 ? "warning" : "default"}
          />
        </div>

        {stats.alertesActives > 0 && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-brand/30 bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark"
          >
            <span aria-hidden="true">⚠ </span>
            {stats.elevesEnAlerte} élève{stats.elevesEnAlerte > 1 ? "s" : ""} de votre école
            {stats.elevesEnAlerte > 1 ? " nécessitent" : " nécessite"} une attention particulière.
            Consultez leurs fiches pour voir les détails.
          </p>
        )}
      </section>

      <StudentDirectory chemin="/enseignant" searchParams={await searchParams} />
    </main>
  );
}
