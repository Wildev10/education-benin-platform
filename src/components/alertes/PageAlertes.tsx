import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge, riskVariant } from "@/components/ui/Badge";
import { rechercherAlertes, type AlerteFiltree } from "@/lib/alertes-server";
import {
  compterFiltresActifs,
  lireFiltres,
  porteeAlertes,
  type FiltresAlertes,
} from "@/lib/filtres-alertes";
import { peutTraiterAlertes } from "@/lib/perimetre";
import { BoutonTraiterAlerte } from "./BoutonTraiterAlerte";
import { ZoneFiltresAlertes } from "./ZoneFiltresAlertes";

/** Au-delà, on invite à affiner plutôt que d'afficher une page interminable. */
const LIMITE_AFFICHAGE = 100;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formaterNombre(valeur: number, decimales = 1) {
  return valeur.toLocaleString("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

function formaterDate(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Porto-Novo",
  });
}

function libelleAucunResultat(filtres: FiltresAlertes) {
  if (compterFiltresActifs(filtres) > 0) return "Aucune alerte ne correspond à ces filtres.";
  return "Aucune alerte active.";
}

function CarteAlerte({
  alerte,
  ficheBase,
  peutTraiter,
}: {
  alerte: AlerteFiltree;
  ficheBase: string;
  peutTraiter: boolean;
}) {
  const { etudiant } = alerte;
  const absences = alerte.type === "absences";

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:border-brand/30 hover:shadow-md sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link
              href={`${ficheBase}/${etudiant.id}`}
              className="min-w-0 text-lg font-bold text-ink underline decoration-border underline-offset-4 hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark"
            >
              {etudiant.prenom} {etudiant.nom}
            </Link>
            <Badge variant={riskVariant(alerte.niveauRisque)}>
              Niveau {alerte.niveauRisque === "eleve" ? "Élevé" : "Moyen"}
            </Badge>
            {alerte.statut === "traitee" && <Badge variant="status-traitee" />}
          </div>
          <p className="mt-1.5 text-ink-secondary">
            {etudiant.etablissement.nom} <span className="text-border" aria-hidden="true">·</span>{" "}
            {etudiant.niveau}
          </p>
        </div>
        {peutTraiter && alerte.statut === "active" && <BoutonTraiterAlerte alerteId={alerte.id} />}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
        <div>
          <dt className="text-sm font-semibold text-ink-secondary">Type</dt>
          <dd className="mt-1 font-semibold text-ink">{absences ? "Absences" : "Notes"}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-ink-secondary">Période</dt>
          <dd className="mt-1 font-semibold text-ink">{alerte.periode}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-ink-secondary">{absences ? "Absences injustifiées" : "Moyenne"}</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {absences ? (
              <span className="text-red-700">{alerte.moyenneApres}</span>
            ) : (
              <>
                <span className="text-ink">{formaterNombre(alerte.moyenneAvant)}</span>
                <span aria-hidden="true" className="mx-1 text-ink-secondary">→</span>
                <span className="sr-only"> puis </span>
                <span className="text-red-700">{formaterNombre(alerte.moyenneApres)}</span>
                <span className="ml-1.5 whitespace-nowrap text-sm font-bold text-red-700">
                  (−{formaterNombre(alerte.ecartPourcent)} %)
                </span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-ink-secondary">Détectée le</dt>
          <dd className="mt-1 font-semibold text-ink">
            <time dateTime={alerte.createdAt.toISOString()}>{formaterDate(alerte.createdAt)}</time>
          </dd>
        </div>
      </dl>
    </article>
  );
}

export async function PageAlertes({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const filtres = lireFiltres(await searchParams);
  const portee = porteeAlertes(session.user);
  const estAdmin = portee.type === "toutes";
  const ficheBase = session.user.role === "admin" ? "/admin/etudiants" : "/enseignant/etudiants";
  const peutTraiter = peutTraiterAlertes(session.user.role);

  const entete = (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">Détection précoce</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Alertes</h1>
      <p className="mt-3 text-lg leading-8 text-ink-secondary">
        {estAdmin
          ? "Toutes les alertes des établissements, à filtrer selon vos besoins."
          : "Les alertes des élèves de votre établissement, à filtrer selon vos besoins."}
      </p>
    </div>
  );

  if (portee.type === "aucune") {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        {entete}
        <div role="alert" className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
          <p className="text-xl font-bold text-amber-950">Aucun établissement rattaché à votre compte</p>
          <p className="mt-2 text-amber-900">
            Les alertes s&apos;afficheront dès que votre compte sera rattaché à un établissement.
            Contactez l&apos;administrateur du Ministère.
          </p>
        </div>
      </main>
    );
  }

  const [{ total, alertes }, etablissements] = await Promise.all([
    rechercherAlertes(filtres, portee, { limite: LIMITE_AFFICHAGE }),
    estAdmin
      ? prisma.etablissement.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } })
      : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      {entete}
      <div className="mt-8">
        <ZoneFiltresAlertes filtres={filtres} etablissements={etablissements}>
          <p role="status" className="text-sm font-semibold text-ink-secondary">
            <span className="text-ink">{total}</span> alerte{total > 1 ? "s" : ""}
            {total > alertes.length && (
              <> · {alertes.length} premières affichées, affinez les filtres pour voir les autres</>
            )}
          </p>

          {alertes.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-border bg-surface px-6 py-10 text-center shadow-sm">
              <span aria-hidden="true" className="text-4xl">🔍</span>
              <p className="mt-3 text-xl font-bold text-ink">{libelleAucunResultat(filtres)}</p>
              {compterFiltresActifs(filtres) > 0 && (
                <p className="mt-2 text-ink-secondary">
                  Modifiez ou réinitialisez les filtres pour élargir la recherche.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 grid gap-4">
              {alertes.map((alerte) => (
                <CarteAlerte key={alerte.id} alerte={alerte} ficheBase={ficheBase} peutTraiter={peutTraiter} />
              ))}
            </div>
          )}
        </ZoneFiltresAlertes>
      </div>
    </main>
  );
}
