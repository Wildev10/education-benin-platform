import { prisma } from "@/lib/prisma";
import StudentDirectory from "../../enseignant/StudentDirectory";

export default async function AdminStudentsPage() {
  const etablissements = await prisma.etablissement.findMany({
    orderBy: { nom: "asc" },
    select: { id: true, nom: true },
  });

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          Pilotage national
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Liste des étudiants
        </h1>
        <p className="mt-3 text-lg leading-8 text-slate-700">
          Repérez rapidement les étudiants qui nécessitent un suivi particulier.
        </p>
      </div>
      <StudentDirectory
        etablissements={etablissements}
        detailBasePath="/admin/etudiants"
        showActiveAlerts
      />
    </main>
  );
}