"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
    etablissement: {
      nom: string;
      departement: string;
    };
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

function riskLabel(niveauRisque: string) {
  return niveauRisque === "eleve" ? "Élevé" : "Moyen";
}

function riskClasses(niveauRisque: string) {
  return niveauRisque === "eleve"
    ? "border-red-300 bg-red-50 text-red-900"
    : "border-amber-300 bg-amber-50 text-amber-950";
}

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
    () => filter === "toutes"
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
        alertesEleve: handledAlert?.niveauRisque === "eleve"
          ? Math.max(0, current.alertesEleve - 1)
          : current.alertesEleve,
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Une erreur est survenue.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <>
      <section aria-label="Chiffres clés" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-semibold text-ink-secondary">Étudiants suivis</p>
          <p className="mt-2 text-4xl font-semibold text-ink">{stats.etudiants}</p>
        </article>
        <article className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-semibold text-ink-secondary">Établissements</p>
          <p className="mt-2 text-4xl font-semibold text-ink">{stats.etablissements}</p>
        </article>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-amber-900">Alertes actives</p>
          <p className="mt-2 text-4xl font-semibold text-amber-950">{stats.alertesActives}</p>
        </article>
        <article className="rounded-xl border-2 border-red-300 bg-red-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-red-900">Risque élevé</p>
          <p className="mt-2 text-4xl font-semibold text-red-950">{stats.alertesEleve}</p>
          <p className="mt-1 text-sm text-red-800">à examiner en priorité</p>
        </article>
      </section>

      <section aria-labelledby="alerts-title" className="mt-10">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-700">Détection précoce</p>
            <h2 id="alerts-title" className="mt-1 text-2xl font-semibold text-ink">Alertes à examiner</h2>
            <p className="mt-2 max-w-2xl text-ink-secondary">Les baisses de résultats qui méritent une attention avant qu'elles ne deviennent un décrochage.</p>
          </div>
          <div aria-label="Filtrer les alertes" className="flex flex-wrap gap-2" role="group">
            {filters.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 ${filter === option.value ? "border-brand bg-brand text-ink" : "border-border bg-surface text-ink-secondary hover:border-ink/30 hover:text-ink"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-medium text-red-800">{error}</p>}

        {alerts.length === 0 ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-900">
            <p className="text-xl font-semibold">Aucune alerte active pour le moment</p>
            <p className="mt-2">Les indicateurs de suivi sont sous contrôle.</p>
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="mt-6 rounded-xl border border-border bg-surface p-8 text-center text-ink-secondary shadow-sm">
            Aucune alerte de niveau {filter === "eleve" ? "élevé" : "moyen"}.
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {visibleAlerts.map((alert) => (
              <article key={alert.id} className="rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:border-brand/30 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={`/admin/etudiants/${alert.etudiant.id}`} className="text-lg font-semibold text-ink underline decoration-border underline-offset-4 hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark">
                        {alert.etudiant.prenom} {alert.etudiant.nom}
                      </Link>
                      <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${riskClasses(alert.niveauRisque)}`}>
                        <span aria-hidden="true">⚠ </span>
                        Niveau {riskLabel(alert.niveauRisque)}
                      </span>
                    </div>
                    <p className="mt-2 text-ink-secondary">
                      {alert.etudiant.etablissement.nom} <span className="text-border">·</span> {alert.etudiant.etablissement.departement}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={processingId === alert.id}
                    onClick={() => void markAsHandled(alert.id)}
                    className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-ink-secondary transition hover:border-brand hover:bg-brand-light hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {processingId === alert.id ? "Mise à jour…" : "Marquer comme traitée"}
                  </button>
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
                      <svg width="22" height="10" viewBox="0 0 22 10" fill="none" aria-hidden="true" className="shrink-0 text-ink-secondary">
                        <path d="M1 5h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M15 1.5L19.5 5 15 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-sm font-semibold text-red-700 tabular-nums">
                        {alert.moyenneApres.toFixed(1)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-ink-secondary">Baisse</dt>
                    <dd className="mt-1 font-semibold text-red-800">−{alert.ecartPourcent.toFixed(1)} %</dd>
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
