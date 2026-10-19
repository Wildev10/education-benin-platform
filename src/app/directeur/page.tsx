import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge, riskVariant } from "@/components/ui/Badge";
import {
  getTableauDeBordDirecteur,
  resoudreAccesDirecteur,
} from "@/lib/tableau-de-bord-directeur";
import { GraphiqueEvolution, GraphiqueNiveaux } from "./DirecteurCharts";
import { ExportExcelButton } from "@/components/ExportPdfButton";

function moyenneCls(moyenne: number) {
  if (moyenne >= 12) return "text-emerald-700";
  if (moyenne >= 10) return "text-orange-700";
  return "text-red-700";
}

function formaterNombre(valeur: number, decimales: number) {
  return valeur.toLocaleString("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

function formaterDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function SansEtablissement() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <span aria-hidden="true" className="text-5xl">🏫</span>
        <h1 className="mt-4 text-2xl font-bold text-amber-950">
          Aucun établissement rattaché à votre compte
        </h1>
        <p className="mt-3 text-lg text-amber-900">
          Votre tableau de bord de directeur s&apos;affichera dès que votre compte sera rattaché à un
          établissement. Contactez l&apos;administrateur du Ministère pour effectuer ce rattachement.
        </p>
      </div>
    </main>
  );
}

function SectionTitre({ id, surtitre, titre, children }: {
  id: string;
  surtitre: string;
  titre: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border pb-4">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">{surtitre}</p>
      <h2 id={id} className="mt-1 text-xl font-bold text-ink">{titre}</h2>
      {children && <p className="mt-1.5 text-sm text-ink-secondary">{children}</p>}
    </div>
  );
}

export default async function DirecteurPage() {
  const acces = resoudreAccesDirecteur(await auth());

  if (acces.statut === "non-connecte") redirect("/login");
  if (acces.statut === "interdit") redirect("/");
  if (acces.statut === "sans-etablissement") return <SansEtablissement />;

  const tdb = await getTableauDeBordDirecteur(acces.etablissementId);
  if (!tdb) return <SansEtablissement />;

  const { etablissement, alertes } = tdb;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">
          Pilotage de l&apos;établissement
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {etablissement.nom}
        </h1>
        <p className="mt-3 text-lg leading-8 text-ink-secondary">
          Département {etablissement.departement} · {etablissement.commune}
          {tdb.anneeScolaire && <> · Année scolaire {tdb.anneeScolaire}</>}
        </p>
        <div className="mt-5">
          <ExportExcelButton
            href={`/api/etablissements/${etablissement.id}/eleves/xlsx`}
            label="Exporter la liste des élèves (Excel)"
            fichierParDefaut="eleves.xlsx"
          />
        </div>
      </div>

      {/* ── Chiffres clés ───────────────────────────────────────── */}
      <section aria-label="Chiffres clés" className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Élèves" value={tdb.nbEleves} sublabel="inscrits" />
        <StatCard
          label="Moyenne générale"
          value={tdb.moyenneGenerale !== null ? formaterNombre(tdb.moyenneGenerale, 2) : "—"}
          sublabel={tdb.moyenneGenerale !== null ? "sur 20" : "aucune note"}
          tone={
            tdb.moyenneGenerale === null
              ? "default"
              : tdb.moyenneGenerale >= 12
                ? "success"
                : tdb.moyenneGenerale >= 10
                  ? "brand"
                  : "danger"
          }
        />
        <StatCard
          label="Alertes actives"
          value={alertes.total}
          sublabel={`Élevé : ${alertes.eleve} · Moyen : ${alertes.moyen}`}
          tone={alertes.eleve > 0 ? "danger" : alertes.total > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Absences injustifiées"
          value={tdb.absencesInjustifieesMois}
          sublabel={`en ${tdb.mois}`}
          tone={tdb.absencesInjustifieesMois > 0 ? "warning" : "default"}
        />
        <div className="col-span-2 lg:col-span-1">
          <StatCard
            label="Élèves en alerte"
            value={`${tdb.tauxElevesEnAlerte.toLocaleString("fr-FR")} %`}
            sublabel={`${tdb.nbElevesEnAlerte} sur ${tdb.nbEleves} élèves`}
            tone={tdb.tauxElevesEnAlerte >= 25 ? "danger" : tdb.tauxElevesEnAlerte >= 10 ? "warning" : "default"}
          />
        </div>
      </section>

      {/* ── Graphiques ──────────────────────────────────────────── */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card as="section" aria-labelledby="evolution-titre" className="min-w-0">
          <SectionTitre id="evolution-titre" surtitre="Tendance" titre="Évolution de la moyenne">
            Moyenne de toutes les notes de l&apos;établissement, par trimestre.
          </SectionTitre>
          <div className="mt-5">
            {tdb.evolution.length > 0 ? (
              <GraphiqueEvolution data={tdb.evolution} />
            ) : (
              <p className="py-10 text-center text-sm text-ink-secondary">Aucune note enregistrée.</p>
            )}
          </div>
        </Card>

        <Card as="section" aria-labelledby="niveaux-titre" className="min-w-0">
          <SectionTitre id="niveaux-titre" surtitre="Comparaison" titre="Moyenne par classe">
            {tdb.anneeScolaire ? `Année ${tdb.anneeScolaire}. ` : ""}Ligne rouge : seuil de 10/20.
          </SectionTitre>
          <div className="mt-5">
            {tdb.moyennesParNiveau.length > 0 ? (
              <GraphiqueNiveaux data={tdb.moyennesParNiveau} />
            ) : (
              <p className="py-10 text-center text-sm text-ink-secondary">Aucune note enregistrée.</p>
            )}
          </div>
        </Card>
      </div>

      {/* ── Listes ──────────────────────────────────────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card as="section" aria-labelledby="risque-titre" className="min-w-0">
          <SectionTitre id="risque-titre" surtitre="Priorités" titre="Élèves les plus à risque">
            Les 5 alertes actives les plus graves.
          </SectionTitre>
          {tdb.elevesARisque.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-secondary">
              <span aria-hidden="true">✓ </span>Aucune alerte active dans l&apos;établissement.
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {tdb.elevesARisque.map((e) => (
                <li key={e.alerteId}>
                  <Link
                    href={`/enseignant/etudiants/${e.etudiantId}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition hover:bg-page focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">
                        {e.prenom} {e.nom}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-ink-secondary">
                        {e.niveau} · {e.periode}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={riskVariant(e.niveauRisque)} />
                      {e.type === "absences" ? (
                        <span className="text-xs font-medium text-ink-secondary">
                          {e.moyenneApres} absences
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-ink-secondary">
                          <span className={`font-semibold ${moyenneCls(e.moyenneApres)}`}>
                            {formaterNombre(e.moyenneApres, 2)}/20
                          </span>{" "}
                          · −{e.ecartPourcent.toLocaleString("fr-FR")} %
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card as="section" aria-labelledby="absences-titre" className="min-w-0">
          <SectionTitre id="absences-titre" surtitre="Assiduité" titre="Dernières absences injustifiées" />
          {tdb.dernieresAbsences.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-secondary">
              <span aria-hidden="true">✓ </span>Aucune absence injustifiée enregistrée.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {tdb.dernieresAbsences.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/enseignant/etudiants/${a.etudiant.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition hover:bg-page focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">
                        {a.etudiant.prenom} {a.etudiant.nom}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-ink-secondary">
                        {a.etudiant.niveau} · {a.periode}
                      </p>
                    </div>
                    <time dateTime={a.date} className="shrink-0 text-sm font-medium text-ink-secondary">
                      {formaterDate(a.date)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
