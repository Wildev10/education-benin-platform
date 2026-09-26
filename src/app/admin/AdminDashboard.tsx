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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossible de traiter l’alerte.");

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
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-600">Étudiants suivis</p>
          <p className="mt-2 text-4xl font-bold text-slate-950">{stats.etudiants}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-600">Établissements</p>
          <p className="mt-2 text-4xl font-bold text-slate-950">{stats.etablissements}</p>
        </article>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-amber-900">Alertes actives</p>
          <p className="mt-2 text-4xl font-bold text-amber-950">{stats.alertesActives}</p>
        </article>
        <article className="rounded-xl border-2 border-red-300 bg-red-50 p-5 shadow-sm">
          <p className="text-sm font-bold text-red-900">Risque élevé</p>
          <p className="mt-2 text-4xl font-bold text-red-950">{stats.alertesEleve}</p>
          <p className="mt-1 text-sm text-red-800">à examiner en priorité</p>
        </article>
      </section>

      <section aria-labelledby="alerts-title" className="mt-10">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-700">Détection précoce</p>
            <h2 id="alerts-title" className="mt-1 text-2xl font-bold text-slate-950">Alertes à examiner</h2>
            <p className="mt-2 max-w-2xl text-slate-700">Les baisses de résultats qui méritent une attention avant qu’elles ne deviennent un décrochage.</p>
          </div>
          <div aria-label="Filtrer les alertes" className="flex flex-wrap gap-2" role="group">
            {filters.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 ${filter === option.value ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-medium text-red-800">{error}</p>}

        {alerts.length === 0 ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-900">
            <p className="text-xl font-bold">Aucune alerte active pour le moment</p>
            <p className="mt-2">Les indicateurs de suivi sont sous contrôle.</p>
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-700 shadow-sm">
            Aucune alerte de niveau {filter === "eleve" ? "élevé" : "moyen"}.
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {visibleAlerts.map((alert) => (
              <article key={alert.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={`/admin/etudiants/${alert.etudiant.id}`} className="text-lg font-bold text-slate-950 underline decoration-slate-300 underline-offset-4 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600">
                        {alert.etudiant.prenom} {alert.etudiant.nom}
                      </Link>
                      <span className={`rounded-full border px-3 py-1 text-sm font-bold ${riskClasses(alert.niveauRisque)}`}>
                        <span aria-hidden="true">⚠ </span>
                        Niveau {riskLabel(alert.niveauRisque)}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-700">
                      {alert.etudiant.etablissement.nom} <span className="text-slate-400">·</span> {alert.etudiant.etablissement.departement}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={processingId === alert.id}
                    onClick={() => void markAsHandled(alert.id)}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-700 hover:bg-teal-50 hover:text-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {processingId === alert.id ? "Mise à jour..." : "Marquer comme traitée"}
                  </button>
                </div>
                <dl className="mt-5 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3">
                  <div>
                    <dt className="text-sm font-semibold text-slate-600">Période</dt>
                    <dd className="mt-1 font-semibold text-slate-950">{alert.periode}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-slate-600">Moyenne</dt>
                    <dd className="mt-1 font-semibold text-slate-950">{alert.moyenneAvant.toFixed(1)} → {alert.moyenneApres.toFixed(1)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-slate-600">Baisse</dt>
                    <dd className="mt-1 font-bold text-red-800">-{alert.ecartPourcent.toFixed(1)}%</dd>
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
