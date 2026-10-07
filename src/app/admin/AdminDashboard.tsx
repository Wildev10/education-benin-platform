"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, riskVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

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

const filters = [
  { value: "toutes", label: "Toutes" },
  { value: "eleve", label: "Élevé" },
  { value: "moyen", label: "Moyen" },
];

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
}: {
  initialAlerts: Alert[];
  initialStats: Stats;
}) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [stats, setStats] = useState(initialStats);
  const [filter, setFilter] = useState("toutes");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const visibleAlerts = useMemo(
    () =>
      filter === "toutes"
        ? alerts
        : alerts.filter((alert) => alert.niveauRisque === filter),
    [alerts, filter]
  );

  async function markAsHandled(alertId: string) {
    setProcessingId(alertId);
    setError("");

    try {
      const response = await fetch(`/api/alertes/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "traitee" }),
      });
      if (response.status === 401) {
        window.location.assign("/login");
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
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Une erreur est survenue."
      );
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
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-700">
              Détection précoce
            </p>
            <h2 id="alerts-title" className="mt-1 flex items-center gap-3 text-2xl font-bold text-ink">
              Alertes à examiner
              {alerts.length > 0 && (
                <span
                  aria-label={`${alerts.length} alerte${alerts.length > 1 ? "s" : ""}`}
                  className="inline-flex items-center justify-center rounded-full bg-red-600 px-2.5 py-0.5 text-sm font-bold text-white"
                >
                  {alerts.length}
                </span>
              )}
            </h2>
            <p className="mt-2 max-w-2xl text-ink-secondary">
              Les baisses de résultats qui méritent une attention avant qu'elles ne deviennent un décrochage.
            </p>
          </div>

          <div aria-label="Filtrer les alertes" className="flex flex-wrap gap-2" role="group">
            {filters.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 ${
                  filter === option.value
                    ? "border-brand bg-brand text-ink"
                    : "border-border bg-surface text-ink-secondary hover:border-ink/30 hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-medium text-red-800">
            {error}
          </p>
        )}

        {alerts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-8 py-10 text-center">
            <span aria-hidden="true" className="text-4xl">✓</span>
            <p className="mt-3 text-xl font-bold text-emerald-900">Aucune alerte active</p>
            <p className="mt-2 text-emerald-800">Les indicateurs de suivi sont sous contrôle.</p>
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center text-ink-secondary shadow-sm">
            Aucune alerte de niveau {filter === "eleve" ? "élevé" : "moyen"}.
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {visibleAlerts.map((alert) => (
              <article
                key={alert.id}
                className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:border-brand/30 hover:shadow-md sm:p-6"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/admin/etudiants/${alert.etudiant.id}`}
                        className="text-lg font-bold text-ink underline decoration-border underline-offset-4 hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark"
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
                    disabled={processingId === alert.id}
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
    </>
  );
}
