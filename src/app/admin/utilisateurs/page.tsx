import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import UtilisateursList from "./UtilisateursList";

export default async function UtilisateursPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/login");

  const utilisateurs = await prisma.user.findMany({
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      role: true,
      etudiantId: true,
      etablissementId: true,
      etablissement: { select: { nom: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">Administration</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Comptes utilisateurs</h1>
          <p className="mt-2 text-ink-secondary">{utilisateurs.length} compte{utilisateurs.length > 1 ? "s" : ""} enregistré{utilisateurs.length > 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/admin/utilisateurs/nouveau"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-dark hover:text-surface focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2"
        >
          <span aria-hidden="true">+</span>
          Nouveau compte
        </Link>
      </div>

      <div className="mt-8">
        <UtilisateursList
          initialUtilisateurs={utilisateurs.map((u) => ({
            ...u,
            createdAt: u.createdAt.toISOString(),
            etablissement: u.etablissement ?? null,
          }))}
          currentUserId={session.user.id ?? ""}
        />
      </div>
    </main>
  );
}
