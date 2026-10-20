import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Pagination } from "@/components/Pagination";
import { filtresHistoriqueVersParams, lireFiltresHistorique } from "@/lib/filtres-historique";
import { getHistoriquePagine } from "@/lib/historique";
import { lirePagination } from "@/lib/pagination";
import { corrigerUrlPagination } from "@/lib/pagination-serveur";
import HistoriqueList from "./HistoriqueList";

const CHEMIN = "/admin/historique";

export default async function HistoriquePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/login");

  const params = await searchParams;
  const filtres = lireFiltresHistorique(params);
  const requete = filtresHistoriqueVersParams(filtres);

  const [resultat, utilisateurs] = await Promise.all([
    getHistoriquePagine(filtres, lirePagination(params)),
    prisma.user.findMany({
      select: { id: true, nom: true, prenom: true },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    }),
  ]);
  corrigerUrlPagination(CHEMIN, requete, params, resultat);

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="border-b border-border pb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">Administration</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Historique des actions</h1>
        <p className="mt-2 text-ink-secondary">
          Les actions effectuées sur la plateforme, des plus récentes aux plus anciennes.
        </p>
      </div>
      <div className="mt-8">
        <HistoriqueList
          logs={resultat.elements}
          filtres={filtres}
          taille={resultat.taille}
          utilisateurs={utilisateurs}
        >
          <Pagination
            chemin={CHEMIN}
            requete={requete.toString()}
            page={resultat.page}
            taille={resultat.taille}
            total={resultat.total}
            nbPages={resultat.nbPages}
            libelle="Pages de l'historique"
          />
        </HistoriqueList>
      </div>
    </main>
  );
}
