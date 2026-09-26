import { prisma } from "@/lib/prisma";
import AdminDashboard from "./AdminDashboard";

export default async function AdminPage() {
  const [etudiants, etablissements, alertes] = await Promise.all([
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
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-red-700">Pilotage national</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Dashboard Ministère</h1>
        <p className="mt-3 text-lg leading-8 text-slate-700">Personne ne voit un décrochage venir avant qu’il soit acté. Notre plateforme le détecte automatiquement.</p>
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
        />
      </div>
    </main>
  );
}
