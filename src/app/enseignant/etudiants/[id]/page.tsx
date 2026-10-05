import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import StudentDetail from "./StudentDetail";

export default async function EtudiantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const etudiant = await prisma.etudiant.findUnique({
    where: { id },
    include: { etablissement: true, notes: { orderBy: { createdAt: "desc" } } },
  });

  if (!etudiant) notFound();

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="mb-8 border-b border-border pb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">Fiche étudiant</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {etudiant.prenom} {etudiant.nom}
        </h1>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium text-ink-secondary">
          <span className="rounded-full border border-border bg-surface px-3 py-1.5 shadow-sm">{etudiant.etablissement.nom}</span>
          <span className="rounded-full bg-brand-light px-3 py-1.5 text-brand-dark ring-1 ring-brand/30">{etudiant.niveau}</span>
        </div>
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
      />
    </main>
  );
}
