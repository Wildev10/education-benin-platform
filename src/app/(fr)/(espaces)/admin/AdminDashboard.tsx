"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, riskVariant, statusVariant } from "@/components/ui/Badge";
import { ExportExcelButton, ExportPdfButton } from "@/components/ExportPdfButton";
import { SqueletteGraphiqueBarres } from "@/components/ui/Squelette";
import { hauteurGraphiqueBarres } from "@/lib/graphiques";
import type { StatsEtablissement } from "@/lib/stats-etablissements";
import { libellePeriode } from "@/lib/notes-trimestres";
import { formaterBaisse, formaterNombre, formaterPourcent } from "@/lib/format";
import type { CleRaccourci, Raccourci } from "@/lib/raccourcis-alertes";
import type { PilotageSuivi } from "@/lib/pilotage-suivi";
import { IconeValide } from "@/components/ui/Icones";
import { CadreDefilant } from "@/components/ui/CadreDefilant";

const AlertesEtablissementChart = dynamic(() => import("./AlertesEtablissementChart"), {
  ssr: false,
  loading: () => <SqueletteGraphiqueBarres className="h-full" />,
});

function moyenneCls(moyenne: number) {
  if (moyenne >= 12) return "text-emerald-700";
  if (moyenne >= 10) return "text-orange-700";
  return "text-red-700";
}

function tauxBarCls(taux: number) {
  if (taux >= 25) return "bg-red-600";
  if (taux >= 10) return "bg-brand";
  return "bg-emerald-500";
}

type Alert = {
  id: string;
  type: string;
  niveauRisque: string;
  periode: string;
  anneeScolaire: string | null;
  moyenneAvant: number;
  moyenneApres: number;
  ecartPourcent: number;
  statut: string;
  suiviDepuis: string | null;
  etudiant: {
    id: string;
    nom: string;
    prenom: string;
    etablissement: { nom: string; departement: string };
  };
};

type Stats = {
  etudiants: number;
  etablissements: number;
  alertesActives: number;
};

/** Repère de couleur de chaque accès direct (bordure gauche), cohérent avec les badges de risque. */
const accentRaccourci: Record<CleRaccourci, string> = {
  eleve: "border-l-red-600",
  absences: "border-l-amber-500",
  recentes: "border-l-ink",
};

const iconEtudiants = (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <circle cx="11" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3 19c0-3.866 3.582-7 8-7s8 3.134 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const iconEtablissements = (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <rect x="3" y="8" width="16" height="11" rx="1" stroke="currentColor" strokeWidth="1.8" />
    <path d="M1 8.5L11 2l10 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="8" y="14" width="6" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const iconAlertes = (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <path d="M11 2L2 19h18L11 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M11 9v4M11 15.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);


export default function AdminDashboard({
  initialAlerts,
  initialStats,
  initialStatsEtablissements,
  raccourcis,
  pilotage,
}: {
  initialAlerts: Alert[];
  initialStats: Stats;
  initialStatsEtablissements: StatsEtablissement[];
  /** Accès directs vers la page Alertes filtrée, comptés côté serveur */
  raccourcis: Raccourci[];
  pilotage: PilotageSuivi;
}) {
  // Les données viennent de la page serveur, recalculée à chaque actualisation
  // (router.refresh) : rien n'est recopié dans l'état. L'admin consulte
  // seulement : le suivi des alertes est fait par l'établissement.
  const alerts = initialAlerts;
  const stats = initialStats;
  const statsEtablissements = initialStatsEtablissements;

  return (
    <>
      {/* ── Chiffres clés : le volume suivi. Le détail des alertes (risque élevé,
           absences, 7 derniers jours) est dans les accès directs, sur les mêmes colonnes dès 1024 px. */}
      <section aria-label="Chiffres clés" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Étudiants suivis"
          value={stats.etudiants}
          icon={iconEtudiants}
        />
        <StatCard
          label="Établissements"
          value={stats.etablissements}
          icon={iconEtablissements}
        />
        <StatCard
          label="Alertes actives"
          value={stats.alertesActives}
          icon={iconAlertes}
          tone="warning"
        />
      </section>

      {/* ── Alertes ────────────────────────────────────────────── */}
      <section aria-labelledby="alerts-title" className="mt-10">
        <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-700">
              Détection précoce
            </p>
            <h2 id="alerts-title" className="mt-1 flex items-center gap-3 text-2xl font-bold text-ink">
              Alertes à examiner
              {alerts.length > 0 && (
                <span
                  aria-label={`${alerts.length} alerte${alerts.length > 1 ? "s" : ""} active${alerts.length > 1 ? "s" : ""}`}
                  className="inline-flex items-center justify-center rounded-full bg-red-600 px-2.5 py-0.5 text-sm font-bold text-white"
                >
                  {alerts.length}
                </span>
              )}
            </h2>
            <p className="mt-2 max-w-2xl text-ink-secondary">
              Baisses de résultats et absences répétées détectées dans tous les établissements, les plus graves en tête.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/alertes"
              className="inline-flex min-h-[42px] tactile:min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-surface transition hover:bg-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2"
            >
              Voir toutes les alertes
            </Link>
            <ExportPdfButton
              href="/api/alertes/pdf"
              label="Exporter en PDF"
              fichierParDefaut="alertes-actives.pdf"
            />
            <ExportExcelButton href="/api/alertes/xlsx" fichierParDefaut="alertes-actives.xlsx" />
          </div>
        </div>

        {/* Accès directs : la page Alertes déjà filtrée, avec le nombre d'alertes actives de chaque vue */}
        <nav aria-label="Accès direct aux alertes" className="mt-5">
          <ul className="grid gap-4 lg:grid-cols-3">
            {raccourcis.map((r) => (
              <li key={r.cle}>
                <Link
                  href={r.href}
                  data-raccourci={r.cle}
                  className={`group flex h-full items-center gap-4 rounded-xl border border-l-4 border-border bg-surface px-4 py-3 transition hover:bg-page focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 ${accentRaccourci[r.cle]}`}
                >
                  <span className="min-w-10 text-3xl font-bold tabular-nums text-ink">{r.total}</span>
                  <span className="min-w-0">
                    {/* text-pretty : jamais un mot seul (« jours ») sur la dernière ligne, sans empêcher le retour à la ligne */}
                    <span className="block text-pretty font-semibold text-ink underline decoration-transparent underline-offset-4 group-hover:decoration-current">
                      {r.libelle}
                    </span>
                    <span className="block text-pretty text-sm text-ink-secondary">{r.precision}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Pilotage du suivi : consultation seule, le suivi est fait par les établissements */}
        <section aria-labelledby="pilotage-suivi-titre" data-pilotage-suivi className="mt-5 rounded-xl border border-border bg-surface px-4 py-4">
          <h3 id="pilotage-suivi-titre" className="font-semibold text-ink">Suivi par les établissements</h3>
          <dl className="mt-3 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm text-ink-secondary">Nouvelles, sans action</dt>
              <dd className="text-xl font-bold tabular-nums text-ink">
                <Link href="/admin/alertes?statut=nouvelle" className="inline-flex min-h-11 min-w-11 items-center underline decoration-border underline-offset-4 hover:text-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark">
                  {pilotage.nouvelles}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-secondary">En cours de suivi</dt>
              <dd className="text-xl font-bold tabular-nums text-ink">
                <Link href="/admin/alertes?statut=en_suivi" className="inline-flex min-h-11 min-w-11 items-center underline decoration-border underline-offset-4 hover:text-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark">
                  {pilotage.enSuivi}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-secondary">Clôturées dans l&apos;année</dt>
              <dd className="text-xl font-bold tabular-nums text-ink">
                <Link href="/admin/alertes?statut=traitee" className="inline-flex min-h-11 min-w-11 items-center underline decoration-border underline-offset-4 hover:text-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark">
                  {pilotage.resolues}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-secondary">Délai moyen avant la première action</dt>
              <dd className="text-xl font-bold tabular-nums text-ink">
                {pilotage.delaiMoyenJours === null ? "—" : `${formaterNombre(pilotage.delaiMoyenJours)} j`}
              </dd>
            </div>
          </dl>
          <div data-motifs-cloture className="mt-4 border-t border-border pt-3">
            <h4 className="text-sm font-semibold text-ink">Motifs de clôture cette année</h4>
            {pilotage.motifs.length === 0 ? (
              <p className="mt-1 text-sm text-ink-secondary">Aucune alerte clôturée dans l&apos;année.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-secondary">
                {pilotage.motifs.map((m) => (
                  <li key={m.motif}>
                    {m.libelle} : <span className="font-semibold tabular-nums text-ink">{m.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {alerts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-8 py-10 text-center">
            <IconeValide taille={32} className="inline-block text-emerald-700" />
            <p className="mt-3 text-xl font-bold text-emerald-900">Aucune alerte active</p>
            <p className="mt-2 text-emerald-800">Les indicateurs de suivi sont sous contrôle.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {alerts.map((alert) => (
              <article
                key={alert.id}
                className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:border-brand/30 hover:shadow-md sm:p-6"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/admin/etudiants/${alert.etudiant.id}`}
                        className="text-lg font-bold text-ink underline tactile:inline-flex tactile:min-h-11 tactile:items-center decoration-border underline-offset-4 hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark"
                      >
                        {alert.etudiant.prenom} {alert.etudiant.nom}
                      </Link>
                      <Badge variant={riskVariant(alert.niveauRisque)}>
                        Niveau {alert.niveauRisque === "eleve" ? "Élevé" : "Moyen"}
                      </Badge>
                      <Badge variant={statusVariant(alert)} />
                    </div>
                    <p className="mt-1.5 text-ink-secondary">
                      {alert.etudiant.etablissement.nom}{" "}
                      <span className="text-border" aria-hidden="true">·</span>{" "}
                      {alert.etudiant.etablissement.departement}
                    </p>
                  </div>

                  <Link
                    href={`/admin/etudiants/${alert.etudiant.id}#alerte-${alert.id}`}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink-secondary transition hover:border-brand hover:bg-brand-light hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2"
                  >
                    Voir le suivi
                    <span className="sr-only"> de {alert.etudiant.prenom} {alert.etudiant.nom}</span>
                  </Link>
                </div>

                <dl className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
                  <div>
                    <dt className="text-sm font-semibold text-ink-secondary">Période</dt>
                    <dd className="mt-1 font-semibold text-ink">{libellePeriode(alert.periode, alert.anneeScolaire)}</dd>
                  </div>
                  {alert.type === "absences" ? (
                    <div>
                      <dt className="text-sm font-semibold text-ink-secondary">Absences injustifiées</dt>
                      <dd className="mt-1 font-bold tabular-nums text-red-700">{alert.moyenneApres}</dd>
                    </div>
                  ) : (
                    <>
                      <div>
                        <dt className="text-sm font-semibold text-ink-secondary">Moyenne</dt>
                        <dd className="mt-1 flex items-center gap-2">
                          <span className="rounded-md border border-border bg-page px-2 py-0.5 text-sm font-semibold text-ink tabular-nums">
                            {formaterNombre(alert.moyenneAvant)}
                          </span>
                          <svg
                            width="22"
                            height="10"
                            viewBox="0 0 22 10"
                            fill="none"
                            aria-hidden="true"
                            className="shrink-0 text-ink-secondary"
                          >
                            <path d="M1 5h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M15 1.5L19.5 5 15 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="sr-only"> puis </span>
                          <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-sm font-semibold text-red-700 tabular-nums">
                            {formaterNombre(alert.moyenneApres)}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-semibold text-ink-secondary">Baisse</dt>
                        <dd className="mt-1 font-bold text-red-700">{formaterBaisse(alert.ecartPourcent)}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── Établissements ─────────────────────────────────────── */}
      <section aria-labelledby="etablissements-title" className="mt-14 border-t-2 border-border pt-10">
        <div className="border-b border-border pb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">Analyse</p>
          <h2 id="etablissements-title" className="mt-1 text-2xl font-bold text-ink">
            Établissements
          </h2>
          <p className="mt-2 max-w-2xl text-ink-secondary">
            Les établissements les plus exposés apparaissent en premier, classés par taux d&apos;alerte.
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <CadreDefilant libelle="Statistiques par établissement">
            <table className="w-full min-w-180 text-left text-sm">
              <caption className="sr-only">Statistiques par établissement</caption>
              <thead>
                <tr className="bg-ink text-surface">
                  <th scope="col" className="px-5 py-4 font-semibold">Établissement</th>
                  <th scope="col" className="px-5 py-4 text-right font-semibold">Élèves</th>
                  <th scope="col" className="px-5 py-4 text-right font-semibold">Alertes actives</th>
                  <th scope="col" className="px-5 py-4 text-right font-semibold">Risque élevé</th>
                  <th scope="col" className="px-5 py-4 text-right font-semibold">Moyenne générale</th>
                  <th scope="col" className="px-5 py-4 font-semibold">Taux d&apos;alerte</th>
                  <th scope="col" className="px-5 py-4 font-semibold">Liste des élèves</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {statsEtablissements.map((e, i) => (
                  <tr key={e.id} className={i % 2 === 1 ? "bg-page" : "bg-surface"}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-ink">{e.nom}</p>
                      <p className="text-xs text-ink-secondary">{e.departement}</p>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-ink">{e.nbEtudiants}</td>
                    <td className="px-5 py-4 text-right">
                      {e.nbAlertesActives > 0 ? (
                        <span className="inline-flex rounded-full border border-orange-300 bg-orange-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-orange-800">
                          {e.nbAlertesActives}
                        </span>
                      ) : (
                        <span className="tabular-nums text-ink-secondary">0</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {e.nbAlertesElevees > 0 ? (
                        <span className="inline-flex rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-red-800">
                          {e.nbAlertesElevees}
                        </span>
                      ) : (
                        <span className="tabular-nums text-ink-secondary">0</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {e.moyenneGenerale === null ? (
                        <span className="text-ink-secondary">—</span>
                      ) : (
                        <span className={`font-bold tabular-nums ${moyenneCls(e.moyenneGenerale)}`}>
                          {formaterNombre(e.moyenneGenerale, 2)}
                          <span className="font-normal text-ink-secondary">/20</span>
                          <span className="block text-xs font-normal text-ink-secondary">{e.anneeMoyenne}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          role="progressbar"
                          aria-valuenow={e.tauxAlerte}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Taux d'alerte ${e.nom}`}
                          className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-border"
                        >
                          <div
                            className={`h-full rounded-full ${tauxBarCls(e.tauxAlerte)}`}
                            style={{ width: `${Math.min(e.tauxAlerte, 100)}%` }}
                          />
                        </div>
                        <span className="tabular-nums font-semibold text-ink">
                          {formaterPourcent(e.tauxAlerte)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <ExportExcelButton
                        href={`/api/etablissements/${e.id}/eleves/xlsx`}
                        fichierParDefaut="eleves.xlsx"
                        ariaLabel={`Exporter la liste des élèves de ${e.nom} en Excel`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CadreDefilant>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-bold text-ink">Alertes actives par établissement</h3>
          <div className="mt-4" style={{ height: hauteurGraphiqueBarres(statsEtablissements.length) }}>
            <AlertesEtablissementChart
              data={[...statsEtablissements].sort((a, b) => b.nbAlertesActives - a.nbAlertesActives)}
            />
          </div>
        </div>
      </section>
    </>
  );
}
