import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHistorique } from "@/lib/historique";
import HistoriqueList from "./HistoriqueList";

export default async function HistoriquePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/login");

  const [logs, utilisateurs] = await Promise.all([
    getHistorique({}),
    prisma.user.findMany({
      select: { id: true, nom: true, prenom: true },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="border-b border-border pb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">Administration</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Historique des actions</h1>
        <p className="mt-2 text-ink-secondary">Les 100 dernières actions effectuées sur la plateforme.</p>
      </div>
      <div className="mt-8">
        <HistoriqueList initialLogs={logs} utilisateurs={utilisateurs} />
      </div>
    </main>
  );
}
