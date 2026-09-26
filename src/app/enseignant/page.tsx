import { prisma } from "@/lib/prisma";
import StudentDirectory from "./StudentDirectory";

export default async function EnseignantPage() {
  const etablissements = await prisma.etablissement.findMany({
    orderBy: { nom: "asc" },
    select: { id: true, nom: true },
  });

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          Tableau de bord
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Espace Enseignant
        </h1>
        <p className="mt-3 text-lg leading-8 text-slate-700">
          Consultez les élèves de vos établissements et suivez leurs résultats au fil des périodes.
        </p>
      </div>
      <StudentDirectory etablissements={etablissements} />
    </main>
  );
}
