"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Note = {
  id: string;
  matiere: string;
  valeur: number;
  periode: string;
  anneeScolaire: string;
  createdAt: string;
};

type Alerte = {
  id: string;
  niveauRisque: string;
  periode: string;
  moyenneAvant: number;
  moyenneApres: number;
  ecartPourcent: number;
  statut: string;
  createdAt: string;
};

type Student = {
  nom: string;
  prenom: string;
  dateNaissance: string;
  sexe: string;
  niveau: string;
  etablissement: { nom: string; departement: string; commune: string };
  notes: Note[];
  alertes: Alerte[];
};

const periodes = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];

function riskLabel(value: string) {
  return value === "eleve" ? "Élevé" : "Moyen";
}

function riskClasses(value: string) {
  return value === "eleve"
    ? "border-red-300 bg-red-50 text-red-900"
    : "border-amber-300 bg-amber-50 text-amber-950";
}

function statusClasses(value: string) {
  return value === "active"
    ? "border-red-300 bg-red-50 text-red-900"
    : "border-border bg-page text-ink-secondary";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

export default function AdminStudentDetail({ student }: { student: Student }) {
  const [alerts, setAlerts] = useState(student.alertes);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const groupedNotes = useMemo(
    () => periodes.map((periode) => ({
      periode,
      notes: student.notes.filter((note) => note.periode === periode),
    })),
    [student.notes]
  );

  const chartData = groupedNotes
    .map(({ periode, notes }) => ({
      periode: periode.replace("Trimestre ", "T"),
      moyenne: notes.length > 0
        ? notes.reduce((total, note) => total + note.valeur, 0) / notes.length
        : null,
    }))
    .filter((item): item is { periode: string; moyenne: number } => item.moyenne !== null);

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
      setAlerts((current) => current.map((alert) => (
        alert.id === alertId ? { ...alert, statut: data.statut } : alert
      )));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Une erreur est survenue.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary shadow-sm transition hover:border-brand hover:bg-brand-light hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Retour au dashboard
      </Link>

      <header className="mt-6 border-b border-border pb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">Fiche étudiant</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{student.prenom} {student.nom}</h1>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-sm font-semibold text-ink-secondary">Établissement</dt><dd className="mt-1 text-lg font-semibold text-ink">{student.etablissement.nom}</dd></div>
          <div><dt className="text-sm font-semibold text-ink-secondary">Niveau</dt><dd className="mt-1 text-lg font-semibold text-ink">{student.niveau}</dd></div>
          <div><dt className="text-sm font-semibold text-ink-secondary">Date de naissance</dt><dd className="mt-1 text-lg font-semibold text-ink">{formatDate(student.dateNaissance)}</dd></div>
          <div><dt className="text-sm font-semibold text-ink-secondary">Sexe</dt><dd className="mt-1 text-lg font-semibold text-ink">{student.sexe}</dd></div>
        </dl>
        <p className="mt-4 text-ink-secondary">{student.etablissement.departement} · {student.etablissement.commune}</p>
      </header>

      <section aria-labelledby="evolution-title" className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">Évolution scolaire</p>
          <h2 id="evolution-title" className="mt-1 text-2xl font-semibold text-ink">Moyenne par période</h2>
          <p className="mt-2 text-ink-secondary">La ligne représente la moyenne de l'étudiant sur 20 pour chaque trimestre disponible.</p>
        </div>
        {chartData.length >= 2 ? (
          <div aria-label="Graphique de l'évolution de la moyenne par trimestre" className="mt-6 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="periode" tick={{ fill: "#404040" }} label={{ value: "Période", position: "insideBottom", offset: -2, fill: "#404040" }} />
                <YAxis domain={[0, 20]} tick={{ fill: "#404040" }} label={{ value: "Moyenne / 20", angle: -90, position: "insideLeft", fill: "#404040" }} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}/20`, "Moyenne"]} />
                <Line type="monotone" dataKey="moyenne" name="Moyenne / 20" stroke="#F97316" strokeWidth={3} dot={{ r: 5, fill: "#F97316" }} activeDot={{ r: 7, fill: "#C2410C" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-6 rounded-lg bg-page p-5 text-ink-secondary">Le graphique apparaîtra dès que l'étudiant aura des notes sur au moins deux périodes.</p>
        )}
      </section>

      <section aria-labelledby="notes-title" className="mt-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">Résultats détaillés</p>
        <h2 id="notes-title" className="mt-1 text-2xl font-semibold text-ink">Notes par période et matière</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {groupedNotes.map(({ periode, notes }) => (
            <section key={periode} className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <h3 className="border-b border-border bg-ink px-5 py-4 font-semibold text-surface">{periode}</h3>
              {notes.length > 0 ? <div className="divide-y divide-border">{notes.map((note) => <div key={note.id} className="flex items-center justify-between gap-4 px-5 py-3"><span className="font-medium text-ink-secondary">{note.matiere}</span><span className="font-semibold text-ink">{note.valeur}/20</span></div>)}</div> : <p className="px-5 py-5 text-ink-secondary">Aucune note pour cette période.</p>}
            </section>
          ))}
        </div>
      </section>

      <section aria-labelledby="alerts-title" className="mt-10">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-700">Suivi des alertes</p>
        <h2 id="alerts-title" className="mt-1 text-2xl font-semibold text-ink">Historique des alertes</h2>
        {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-medium text-red-800">{error}</p>}
        {alerts.length > 0 ? (
          <div className="mt-5 space-y-4">
            {alerts.map((alert) => (
              <article key={alert.id} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${riskClasses(alert.niveauRisque)}`}>
                      <span aria-hidden="true">⚠ </span>Niveau {riskLabel(alert.niveauRisque)}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${statusClasses(alert.statut)}`}>
                      <span aria-hidden="true">{alert.statut === "active" ? "! " : "✓ "}</span>{alert.statut === "active" ? "Active" : "Traitée"}
                    </span>
                    <span className="font-semibold text-ink">{alert.periode}</span>
                  </div>
                  {alert.statut === "active" && (
                    <button
                      type="button"
                      disabled={processingId === alert.id}
                      onClick={() => void markAsHandled(alert.id)}
                      className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-ink-secondary hover:border-brand hover:bg-brand-light hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {processingId === alert.id ? "Mise à jour…" : "Marquer comme traitée"}
                    </button>
                  )}
                </div>
                <dl className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-4">
                  <div><dt className="text-sm font-semibold text-ink-secondary">Moyenne</dt><dd className="mt-1 font-semibold text-ink">{alert.moyenneAvant.toFixed(1)} → {alert.moyenneApres.toFixed(1)}</dd></div>
                  <div><dt className="text-sm font-semibold text-ink-secondary">Baisse</dt><dd className="mt-1 font-semibold text-red-800">−{alert.ecartPourcent.toFixed(1)} %</dd></div>
                  <div><dt className="text-sm font-semibold text-ink-secondary">Date</dt><dd className="mt-1 font-semibold text-ink">{formatDate(alert.createdAt)}</dd></div>
                  <div><dt className="text-sm font-semibold text-ink-secondary">Période</dt><dd className="mt-1 font-semibold text-ink">{alert.periode}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
            <span aria-hidden="true">✓ </span>Aucune alerte dans l'historique de cet étudiant.
          </p>
        )}
      </section>
    </main>
  );
}
