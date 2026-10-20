import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Pagination } from "@/components/Pagination";
import { lirePagination } from "@/lib/pagination";
import { corrigerUrlPagination } from "@/lib/pagination-serveur";
import { prisma } from "@/lib/prisma";
import { getDemandesEnAttente } from "@/lib/reset-requests";
import { listerUtilisateursPagines } from "@/lib/utilisateurs-server";
import UtilisateursList from "./UtilisateursList";

const CHEMIN = "/admin/utilisateurs";

export default async function UtilisateursPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/login");

  const params = await searchParams;
  const [resultat, etablissements, demandes] = await Promise.all([
    listerUtilisateursPagines(lirePagination(params)),
    prisma.etablissement.findMany({
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
    }),
    getDemandesEnAttente(),
  ]);
  corrigerUrlPagination(CHEMIN, new URLSearchParams(), params, resultat);
  const { total } = resultat;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">Administration</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Comptes utilisateurs</h1>
          <p className="mt-2 text-ink-secondary">{total} compte{total > 1 ? "s" : ""} enregistré{total > 1 ? "s" : ""}</p>
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
          utilisateurs={resultat.elements.map((u) => ({
            ...u,
            createdAt: u.createdAt.toISOString(),
            etablissement: u.etablissement ?? null,
          }))}
          currentUserId={session.user.id ?? ""}
          etablissements={etablissements}
          initialDemandes={demandes}
        />
        <Pagination
          chemin={CHEMIN}
          requete=""
          page={resultat.page}
          taille={resultat.taille}
          total={total}
          nbPages={resultat.nbPages}
          libelle="Pages des comptes"
        />
      </div>
    </main>
  );
}
