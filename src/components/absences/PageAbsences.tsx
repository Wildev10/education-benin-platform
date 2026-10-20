import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Pagination } from "@/components/Pagination";
import { anneesAbsences, rechercherAbsencesPaginees } from "@/lib/absences-server";
import { MOTIFS, filtresAbsencesVersParams, lireFiltresAbsences } from "@/lib/filtres-absences";
import { lirePagination } from "@/lib/pagination";
import { corrigerUrlPagination } from "@/lib/pagination-serveur";
import { prisma } from "@/lib/prisma";
import { ZoneFiltresAbsences } from "./ZoneFiltresAbsences";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Porto-Novo",
});

const motifCls = {
  injustifiee: "border-red-300 bg-red-50 text-red-900",
  justifiee: "border-emerald-300 bg-emerald-50 text-emerald-900",
} as const;

/**
 * Liste paginée des absences (admin : toutes ; directeur et enseignant : leur
 * établissement). Partagée par /admin/absences, /directeur/absences et
 * /enseignant/absences.
 */
export async function PageAbsences({ chemin, searchParams }: { chemin: string; searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const estAdmin = session.user.role === "admin";
  const ficheBase = estAdmin ? "/admin/etudiants" : "/enseignant/etudiants";
  const sansEtablissement = !estAdmin && !session.user.etablissementId;

  const entete = (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">Assiduité</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Absences</h1>
      <p className="mt-3 text-lg leading-8 text-ink-secondary">
        {estAdmin
          ? "Toutes les absences enregistrées dans les établissements, les plus récentes d'abord."
          : "Les absences des élèves de votre établissement, les plus récentes d'abord."}
      </p>
    </div>
  );

  if (sansEtablissement) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        {entete}
        <div role="alert" className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
          <p className="text-xl font-bold text-amber-950">Aucun établissement rattaché à votre compte</p>
          <p className="mt-2 text-amber-900">
            Les absences s&apos;afficheront dès que votre compte sera rattaché à un établissement.
            Contactez l&apos;administrateur du Ministère.
          </p>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const lus = lireFiltresAbsences(params);
  // La page ne filtre pas sur un élève précis, et seul l'admin choisit l'établissement
  const filtres = { ...lus, etudiantId: undefined, etablissement: estAdmin ? lus.etablissement : undefined };
  const requete = filtresAbsencesVersParams(filtres);

  const [resultat, annees, etablissements] = await Promise.all([
    rechercherAbsencesPaginees(filtres, session.user, lirePagination(params)),
    anneesAbsences(session.user),
    estAdmin
      ? prisma.etablissement.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } })
      : Promise.resolve(null),
  ]);
  corrigerUrlPagination(chemin, requete, params, resultat);
  const { total, elements: absences } = resultat;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      {entete}
      <div className="mt-8">
        <ZoneFiltresAbsences filtres={filtres} taille={resultat.taille} annees={annees} etablissements={etablissements}>
          <p role="status" className="text-sm font-semibold text-ink-secondary">
            <span className="text-ink">{total}</span> absence{total > 1 ? "s" : ""}
          </p>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-160 text-left text-sm">
                <caption className="sr-only">Liste filtrée des absences</caption>
                <thead>
                  <tr className="bg-ink text-surface">
                    <th scope="col" className="px-5 py-4 font-semibold">Date</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Élève</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Établissement</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Période</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Motif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {absences.map((absence, i) => (
                    <tr key={absence.id} className={i % 2 === 1 ? "bg-page" : "bg-surface"}>
                      <td className="whitespace-nowrap px-5 py-4 text-ink-secondary">
                        <time dateTime={absence.date.toISOString()}>{dateFmt.format(absence.date)}</time>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`${ficheBase}/${absence.etudiant.id}`}
                          className="font-semibold text-ink underline decoration-transparent underline-offset-4 hover:text-brand-dark hover:decoration-brand/30 focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2"
                        >
                          {absence.etudiant.prenom} {absence.etudiant.nom}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-secondary">{absence.etudiant.niveau}</p>
                      </td>
                      <td className="px-5 py-4 text-ink-secondary">{absence.etudiant.etablissement.nom}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-ink-secondary">
                        {absence.periode} · {absence.anneeScolaire}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            motifCls[absence.motif as keyof typeof motifCls] ?? "border-border bg-page text-ink-secondary"
                          }`}
                        >
                          {MOTIFS[absence.motif as keyof typeof MOTIFS] ?? absence.motif}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {absences.length === 0 && (
              <p className="px-5 py-8 text-center text-ink-secondary">
                {requete.size > 0 ? "Aucune absence ne correspond à ces filtres." : "Aucune absence enregistrée."}
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
            libelle="Pages des absences"
          />
        </ZoneFiltresAbsences>
      </div>
    </main>
  );
}
