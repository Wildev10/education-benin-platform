"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, riskVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ExportExcelButton, ExportPdfButton } from "@/components/ExportPdfButton";
import { Toast, Confirm } from "@/lib/swal";
import { useHorsLigne } from "@/components/pwa/PwaProvider";
import { TITRE_HORS_LIGNE } from "@/components/pwa/BandeauHorsLigne";
import { SqueletteGraphiqueBarres } from "@/components/ui/Squelette";
import { hauteurGraphiqueBarres } from "@/lib/graphiques";
import type { StatsEtablissement } from "@/lib/stats-etablissements";
import type { CleRaccourci, Raccourci } from "@/lib/raccourcis-alertes";
import { redirigerVersConnexion } from "@/lib/session-expiree";
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
  niveauRisque: string;
  periode: string;
  moyenneAvant: number;
  moyenneApres: number;
  ecartPourcent: number;
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
  alertesEleve: number;
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

const iconElevé = (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <path d="M11 2L2 19h18L11 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
    <path d="M11 9v4M11 15.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export default function AdminDashboard({
  initialAlerts,
  initialStats,
  initialStatsEtablissements,
  raccourcis,
}: {
  initialAlerts: Alert[];
  initialStats: Stats;
  initialStatsEtablissements: StatsEtablissement[];
  /** Accès directs vers la page Alertes filtrée, comptés côté serveur */
  raccourcis: Raccourci[];
}) {
  const router = useRouter();
  const [alerts, setAlerts] = useState(initialAlerts);
  const [stats, setStats] = useState(initialStats);
  const [statsEtablissements, setStatsEtablissements] = useState(initialStatsEtablissements);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const horsLigne = useHorsLigne();
  const [error, setError] = useState("");


  async function markAsHandled(alertId: string) {
    const result = await Confirm.fire({
      title: "Êtes-vous sûr ?",
      text: "Cette action est irréversible.",
      icon: "warning",
      showCancelButton: true,
    });
    if (!result.isConfirmed) return;
    setProcessingId(alertId);
    setError("");

    try {
      const response = await fetch(`/api/alertes/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "traitee" }),
      });
      if (response.status === 401) {
        redirigerVersConnexion();
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossible de traiter l'alerte.");

      const handledAlert = alerts.find((alert) => alert.id === alertId);
      setAlerts((current) => current.filter((alert) => alert.id !== alertId));
      setStats((current) => ({
        ...current,
        alertesActives: Math.max(0, current.alertesActives - 1),
        alertesEleve:
          handledAlert?.niveauRisque === "eleve"
            ? Math.max(0, current.alertesEleve - 1)
            : current.alertesEleve,
      }));
      void Toast.fire({ icon: "success", title: "Alerte marquée comme traitée." });
      router.refresh(); // compteurs des accès directs recalculés côté serveur
      void fetch("/api/admin/stats/etablissements")
        .then((res) => (res.ok ? res.json() : null))
        .then((data: StatsEtablissement[] | null) => data && setStatsEtablissements(data))
        .catch(() => {});
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Une erreur est survenue."
      );
      void Toast.fire({ icon: "error", title: "Erreur lors de la mise à jour." });
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <>
      {/* ── Stat cards ─────────────────────────────────────────── */}
      <section aria-label="Chiffres clés" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <StatCard
          label="Risque élevé"
          value={stats.alertesEleve}
          sublabel="à examiner en priorité"
          icon={iconElevé}
          tone="danger"
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
          <ul className="grid gap-3 sm:grid-cols-3">
            {raccourcis.map((r) => (
              <li key={r.cle}>
                <Link
                  href={r.href}
                  data-raccourci={r.cle}
                  className={`group flex h-full items-center gap-4 rounded-xl border border-l-4 border-border bg-surface px-4 py-3 transition hover:bg-page focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 ${accentRaccourci[r.cle]}`}
                >
                  <span className="min-w-10 text-3xl font-bold tabular-nums text-ink">{r.total}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink underline decoration-transparent underline-offset-4 group-hover:decoration-current">
                      {r.libelle}
                    </span>
                    <span className="block text-sm text-ink-secondary">{r.precision}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {error && (
          <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-medium text-red-800">
            {error}
          </p>
        )}

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
                    </div>
                    <p className="mt-1.5 text-ink-secondary">
                      {alert.etudiant.etablissement.nom}{" "}
                      <span className="text-border" aria-hidden="true">·</span>{" "}
                      {alert.etudiant.etablissement.departement}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    disabled={processingId === alert.id || horsLigne}
                    title={horsLigne ? TITRE_HORS_LIGNE : undefined}
                    onClick={() => void markAsHandled(alert.id)}
                  >
                    {processingId === alert.id ? "Mise à jour…" : "Marquer comme traitée"}
                  </Button>
                </div>

                <dl className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
                  <div>
                    <dt className="text-sm font-semibold text-ink-secondary">Période</dt>
                    <dd className="mt-1 font-semibold text-ink">{alert.periode}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-ink-secondary">Moyenne</dt>
                    <dd className="mt-1 flex items-center gap-2">
                      <span className="rounded-md border border-border bg-page px-2 py-0.5 text-sm font-semibold text-ink tabular-nums">
                        {alert.moyenneAvant.toFixed(1)}
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
                      <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-sm font-semibold text-red-700 tabular-nums">
                        {alert.moyenneApres.toFixed(1)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-ink-secondary">Baisse</dt>
                    <dd className="mt-1 font-bold text-red-700">−{alert.ecartPourcent.toFixed(1)} %</dd>
                  </div>
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
                          {e.moyenneGenerale.toFixed(2)}
                          <span className="font-normal text-ink-secondary">/20</span>
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
                          {e.tauxAlerte.toLocaleString("fr-FR")} %
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
