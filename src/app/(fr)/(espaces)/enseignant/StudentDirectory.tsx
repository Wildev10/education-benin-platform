import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/Pagination";
import { rechercherElevesPagines } from "@/lib/eleves-server";
import { filtresElevesVersParams, lireFiltresEleves } from "@/lib/filtres-eleves";
import { lirePagination } from "@/lib/pagination";
import { corrigerUrlPagination } from "@/lib/pagination-serveur";
import { FiltresEleves } from "./FiltresEleves";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Liste paginée des élèves (admin, directeur, enseignant). Filtres, page et
 * taille viennent de l'URL ; le périmètre du rôle est appliqué avant la
 * pagination, si bien que le total ne compte que les élèves visibles.
 */
export default async function StudentDirectory({
  chemin,
  searchParams,
  detailBasePath = "/enseignant/etudiants",
  showActiveAlerts = false,
}: {
  chemin: string;
  searchParams: SearchParams;
  detailBasePath?: string;
  showActiveAlerts?: boolean;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const estAdmin = session.user.role === "admin";
  const lus = lireFiltresEleves(searchParams);
  // Hors admin, le filtre établissement de l'URL est sans effet : on ne le garde pas dans les liens
  const filtres = estAdmin ? lus : { ...lus, etablissement: undefined };
  const requete = filtresElevesVersParams(filtres);

  const [resultat, etablissements] = await Promise.all([
    rechercherElevesPagines(filtres, session.user, lirePagination(searchParams)),
    estAdmin
      ? prisma.etablissement.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } })
      : Promise.resolve(null),
  ]);
  corrigerUrlPagination(chemin, requete, searchParams, resultat);

  const sansEtablissement = !estAdmin && !session.user.etablissementId;
  const { elements: etudiants, total } = resultat;

  return (
    <section aria-labelledby="liste-etudiants" className="mt-8">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
            Suivi pédagogique
          </p>
          <h2 id="liste-etudiants" className="mt-1 text-2xl font-bold text-ink">
            Étudiants
          </h2>
        </div>
        <p role="status" className="text-sm text-ink-secondary">
          {total} étudiant{total > 1 ? "s" : ""}
          {filtres.q ? ` trouvé${total > 1 ? "s" : ""}` : ""}
        </p>
      </div>

      {sansEtablissement ? (
        <div role="alert" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
          <p className="text-xl font-bold text-amber-950">Aucun établissement rattaché à votre compte</p>
          <p className="mt-2 text-amber-900">
            La liste des élèves s&apos;affichera dès que votre compte sera rattaché à un établissement.
            Contactez l&apos;administrateur.
          </p>
        </div>
      ) : (
        <FiltresEleves filtres={filtres} taille={resultat.taille} etablissements={etablissements}>
          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-160 text-left">
                <caption className="sr-only">Liste filtrée des étudiants</caption>
                <thead>
                  <tr className="bg-ink text-sm text-surface">
                    <th scope="col" className="px-5 py-4 font-semibold">Nom</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Prénom</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Établissement</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Niveau</th>
                    {showActiveAlerts && (
                      <th scope="col" className="px-5 py-4 font-semibold">Suivi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {etudiants.map((etudiant, i) => (
                    <tr
                      key={etudiant.id}
                      className={`transition hover:bg-brand-light ${i % 2 === 1 ? "bg-page" : "bg-surface"}`}
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`${detailBasePath}/${etudiant.id}`}
                          className="font-semibold text-ink underline decoration-transparent underline-offset-4 hover:text-brand-dark hover:decoration-brand/30 focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2"
                        >
                          {etudiant.nom}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-ink-secondary">{etudiant.prenom}</td>
                      <td className="px-5 py-4 text-ink-secondary">{etudiant.etablissement.nom}</td>
                      <td className="px-5 py-4 text-ink-secondary">{etudiant.niveau}</td>
                      {showActiveAlerts && (
                        <td className="px-5 py-4">
                          {etudiant.alerteActive ? (
                            <Badge variant="risk-eleve">Alerte active</Badge>
                          ) : (
                            <span className="text-sm text-ink-secondary">Aucune alerte</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {etudiants.length === 0 && (
              <p className="p-8 text-center text-ink-secondary">
                Aucun étudiant ne correspond à ces filtres.
              </p>
            )}
          </div>
          <Pagination
            chemin={chemin}
            requete={requete.toString()}
            page={resultat.page}
            taille={resultat.taille}
            total={total}
            nbPages={resultat.nbPages}
            libelle="Pages des étudiants"
          />
        </FiltresEleves>
      )}
    </section>
  );
}
