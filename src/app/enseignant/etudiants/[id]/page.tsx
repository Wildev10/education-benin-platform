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
      <div className="mb-8 border-b border-slate-200 pb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">Fiche étudiant</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {etudiant.prenom} {etudiant.nom}
        </h1>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium text-slate-700">
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-slate-200">{etudiant.etablissement.nom}</span>
          <span className="rounded-full bg-teal-50 px-3 py-1.5 text-teal-900 ring-1 ring-teal-200">{etudiant.niveau}</span>
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
