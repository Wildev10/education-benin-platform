import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ExportPdfButton } from "@/components/ExportPdfButton";
import { peutAccederEtudiant, peutTraiterAlertes } from "@/lib/perimetre";
import StudentDetail from "./StudentDetail";
import AlertesEleve from "./AlertesEleve";

export default async function EtudiantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const etudiant = await prisma.etudiant.findUnique({
    where: { id },
    include: {
      etablissement: true,
      notes: { orderBy: { createdAt: "desc" } },
      absences: { orderBy: { date: "desc" } },
      alertes: { orderBy: { createdAt: "desc" } },
    },
  });

  // Élève d'un autre établissement : même page que s'il n'existait pas
  if (!etudiant || !peutAccederEtudiant(session.user, etudiant)) notFound();

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="mb-8 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">Fiche étudiant</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {etudiant.prenom} {etudiant.nom}
          </h1>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium text-ink-secondary">
            <span className="rounded-full border border-border bg-surface px-3 py-1.5 shadow-sm">{etudiant.etablissement.nom}</span>
            <span className="rounded-full bg-brand-light px-3 py-1.5 text-brand-dark ring-1 ring-brand/30">{etudiant.niveau}</span>
          </div>
        </div>
        <ExportPdfButton
          href={`/api/etudiants/${etudiant.id}/pdf`}
          label="Exporter en PDF"
          fichierParDefaut="fiche-etudiant.pdf"
        />
      </div>
      <StudentDetail
        etudiantId={etudiant.id}
        initialNotes={etudiant.notes.map((note) => ({
          id: note.id,
          matiere: note.matiere,
          valeur: note.valeur,
          periode: note.periode,
          anneeScolaire: note.anneeScolaire,
        }))}
        initialAbsences={etudiant.absences.map((a) => ({
          id: a.id,
          date: a.date.toISOString(),
          motif: a.motif,
          periode: a.periode,
          anneeScolaire: a.anneeScolaire,
        }))}
      />
      <AlertesEleve
        peutTraiter={peutTraiterAlertes(session.user.role)}
        initialAlertes={etudiant.alertes.map((a) => ({
          id: a.id,
          type: a.type,
          niveauRisque: a.niveauRisque,
          statut: a.statut,
          periode: a.periode,
          moyenneAvant: a.moyenneAvant,
          moyenneApres: a.moyenneApres,
          ecartPourcent: a.ecartPourcent,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
