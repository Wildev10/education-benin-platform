import { prisma } from "@/lib/prisma";
import { getStatsEtablissements } from "@/lib/stats-etablissements";
import { raccourcisAlertes } from "@/lib/raccourcis-alertes";
import AdminDashboard from "./AdminDashboard";

/** Date et heure des données affichées (la page est calculée à chaque chargement) */
const formatDonnees = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Porto-Novo" });

export default async function AdminPage() {
  const maintenant = new Date();
  const [etudiants, etablissements, alertes, statsEtablissements, raccourcis] = await Promise.all([
    prisma.etudiant.count(),
    prisma.etablissement.count(),
    prisma.alerte.findMany({
      where: { statut: "active" },
      include: {
        etudiant: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            etablissement: { select: { nom: true, departement: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getStatsEtablissements(),
    raccourcisAlertes({ type: "toutes" }),
  ]);

  const alertesTriees = alertes.sort((a, b) => {
    const niveauA = a.niveauRisque === "eleve" ? 2 : 1;
    const niveauB = b.niveauRisque === "eleve" ? 2 : 1;
    return niveauB - niveauA || b.createdAt.getTime() - a.createdAt.getTime();
  });
  const alertesEleve = alertes.filter((alerte) => alerte.niveauRisque === "eleve").length;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">Pilotage national</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Tableau de bord national</h1>
        <p className="mt-3 text-lg leading-8 text-ink-secondary">
          Périmètre : tous les établissements. Données du{" "}
          <time dateTime={maintenant.toISOString()}>{formatDonnees.format(maintenant)}</time>, heure du Bénin.
        </p>
      </div>
      <div className="mt-8">
        <AdminDashboard
          initialStats={{
            etudiants,
            etablissements,
            alertesActives: alertes.length,
            alertesEleve,
          }}
          initialAlerts={alertesTriees.map((alerte) => ({
            id: alerte.id,
            niveauRisque: alerte.niveauRisque,
            periode: alerte.periode,
            moyenneAvant: alerte.moyenneAvant,
            moyenneApres: alerte.moyenneApres,
            ecartPourcent: alerte.ecartPourcent,
            etudiant: alerte.etudiant,
          }))}
          initialStatsEtablissements={statsEtablissements}
          raccourcis={raccourcis}
        />
      </div>
    </main>
  );
}
