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
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">
          Pilotage national
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Liste des étudiants
        </h1>
        <p className="mt-3 text-lg leading-8 text-ink-secondary">
          Trouvez vite les étudiants à suivre.
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
