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
    : "border-slate-300 bg-slate-100 text-slate-800";
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossible de traiter l’alerte.");
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
      <Link href="/admin" className="text-sm font-semibold text-teal-800 underline underline-offset-4 hover:text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-600">
        ← Retour au dashboard
      </Link>

      <header className="mt-6 border-b border-slate-200 pb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">Fiche étudiant</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{student.prenom} {student.nom}</h1>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-sm font-semibold text-slate-600">Établissement</dt><dd className="mt-1 text-lg font-semibold text-slate-950">{student.etablissement.nom}</dd></div>
          <div><dt className="text-sm font-semibold text-slate-600">Niveau</dt><dd className="mt-1 text-lg font-semibold text-slate-950">{student.niveau}</dd></div>
          <div><dt className="text-sm font-semibold text-slate-600">Date de naissance</dt><dd className="mt-1 text-lg font-semibold text-slate-950">{formatDate(student.dateNaissance)}</dd></div>
          <div><dt className="text-sm font-semibold text-slate-600">Sexe</dt><dd className="mt-1 text-lg font-semibold text-slate-950">{student.sexe}</dd></div>
        </dl>
        <p className="mt-4 text-slate-700">{student.etablissement.departement} · {student.etablissement.commune}</p>
      </header>

      <section aria-labelledby="evolution-title" className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">Évolution scolaire</p>
          <h2 id="evolution-title" className="mt-1 text-2xl font-bold text-slate-950">Moyenne par période</h2>
          <p className="mt-2 text-slate-700">La ligne représente la moyenne de l’étudiant sur 20 pour chaque trimestre disponible.</p>
        </div>
        {chartData.length >= 2 ? (
          <div aria-label="Graphique de l’évolution de la moyenne par trimestre" className="mt-6 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis dataKey="periode" tick={{ fill: "#334155" }} label={{ value: "Période", position: "insideBottom", offset: -2, fill: "#334155" }} />
                <YAxis domain={[0, 20]} tick={{ fill: "#334155" }} label={{ value: "Moyenne / 20", angle: -90, position: "insideLeft", fill: "#334155" }} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}/20`, "Moyenne"]} />
                <Line type="monotone" dataKey="moyenne" name="Moyenne / 20" stroke="#0f766e" strokeWidth={3} dot={{ r: 5, fill: "#0f766e" }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-6 rounded-lg bg-slate-100 p-5 text-slate-700">Le graphique apparaîtra dès que l’étudiant aura des notes sur au moins deux périodes.</p>
        )}
      </section>

      <section aria-labelledby="notes-title" className="mt-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">Résultats détaillés</p>
        <h2 id="notes-title" className="mt-1 text-2xl font-bold text-slate-950">Notes par période et matière</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {groupedNotes.map(({ periode, notes }) => (
            <section key={periode} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <h3 className="border-b border-slate-200 bg-slate-100 px-5 py-4 font-bold text-slate-950">{periode}</h3>
              {notes.length > 0 ? <div className="divide-y divide-slate-200">{notes.map((note) => <div key={note.id} className="flex items-center justify-between gap-4 px-5 py-3"><span className="font-medium text-slate-800">{note.matiere}</span><span className="font-bold text-slate-950">{note.valeur}/20</span></div>)}</div> : <p className="px-5 py-5 text-slate-600">Aucune note pour cette période.</p>}
            </section>
          ))}
        </div>
      </section>

      <section aria-labelledby="alerts-title" className="mt-10">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-700">Suivi des alertes</p>
        <h2 id="alerts-title" className="mt-1 text-2xl font-bold text-slate-950">Historique des alertes</h2>
        {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-medium text-red-800">{error}</p>}
        {alerts.length > 0 ? <div className="mt-5 space-y-4">{alerts.map((alert) => <article key={alert.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div className="flex flex-wrap items-center gap-3"><span className={`rounded-full border px-3 py-1 text-sm font-bold ${riskClasses(alert.niveauRisque)}`}>Niveau {riskLabel(alert.niveauRisque)}</span><span className={`rounded-full border px-3 py-1 text-sm font-bold ${statusClasses(alert.statut)}`}>{alert.statut === "active" ? "Active" : "Traitée"}</span><span className="font-semibold text-slate-800">{alert.periode}</span></div>{alert.statut === "active" && <button type="button" disabled={processingId === alert.id} onClick={() => void markAsHandled(alert.id)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-teal-700 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{processingId === alert.id ? "Mise à jour..." : "Marquer comme traitée"}</button>}</div><dl className="mt-5 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-4"><div><dt className="text-sm font-semibold text-slate-600">Moyenne</dt><dd className="mt-1 font-semibold text-slate-950">{alert.moyenneAvant.toFixed(1)} → {alert.moyenneApres.toFixed(1)}</dd></div><div><dt className="text-sm font-semibold text-slate-600">Baisse</dt><dd className="mt-1 font-bold text-red-800">-{alert.ecartPourcent.toFixed(1)}%</dd></div><div><dt className="text-sm font-semibold text-slate-600">Date</dt><dd className="mt-1 font-semibold text-slate-950">{formatDate(alert.createdAt)}</dd></div><div><dt className="text-sm font-semibold text-slate-600">Période</dt><dd className="mt-1 font-semibold text-slate-950">{alert.periode}</dd></div></dl></article>)}</div> : <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">Aucune alerte dans l’historique de cet étudiant.</p>}
      </section>
    </main>
  );
}
