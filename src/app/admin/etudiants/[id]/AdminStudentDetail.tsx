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
import { Badge, riskVariant, statusVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";

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

type Absence = {
  id: string;
  date: string;
  motif: string;
  periode: string;
  anneeScolaire: string;
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
  absences: Absence[];
};

const periodes = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

export default function AdminStudentDetail({ student }: { student: Student }) {
  const { showToast } = useToast();
  const [alerts, setAlerts] = useState(student.alertes);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const groupedNotes = useMemo(
    () =>
      periodes.map((periode) => ({
        periode,
        notes: student.notes.filter((note) => note.periode === periode),
      })),
    [student.notes]
  );

  const chartData = groupedNotes
    .map(({ periode, notes }) => ({
      periode: periode.replace("Trimestre ", "T"),
      moyenne:
        notes.length > 0
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
      if (response.status === 401) { window.location.assign("/login"); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossible de traiter l'alerte.");
      setAlerts((current) =>
        current.map((alert) => (alert.id === alertId ? { ...alert, statut: data.statut } : alert))
      );
      showToast("Alerte marquée comme traitée.", "success");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Une erreur est survenue.");
      showToast("Erreur lors de la mise à jour.", "error");
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
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Retour au dashboard
      </Link>

      <header className="mt-6 border-b border-border pb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">
          Fiche étudiant
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {student.prenom} {student.nom}
        </h1>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-sm font-semibold text-ink-secondary">Établissement</dt>
            <dd className="mt-1 text-lg font-semibold text-ink">{student.etablissement.nom}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-secondary">Niveau</dt>
            <dd className="mt-1 text-lg font-semibold text-ink">{student.niveau}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-secondary">Date de naissance</dt>
            <dd className="mt-1 text-lg font-semibold text-ink">{formatDate(student.dateNaissance)}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-secondary">Sexe</dt>
            <dd className="mt-1 text-lg font-semibold text-ink">{student.sexe}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-ink-secondary">
          {student.etablissement.departement} · {student.etablissement.commune}
        </p>
      </header>

      {/* Graphique d'évolution */}
      <section
        aria-labelledby="evolution-title"
        className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm"
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
            Évolution scolaire
          </p>
          <h2 id="evolution-title" className="mt-1 text-2xl font-bold text-ink">
            Moyenne par période
          </h2>
          <p className="mt-2 text-sm text-ink-secondary">
            Progression trimestrielle sur 20 points.
          </p>
        </div>
        {chartData.length >= 2 ? (
          <div
            aria-label="Graphique de l'évolution de la moyenne par trimestre"
            className="mt-6 h-72 w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 16, right: 24, bottom: 12, left: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#E5E5E5" vertical={false} />
                <XAxis
                  dataKey="periode"
                  tick={{ fill: "#404040", fontSize: 13 }}
                  axisLine={{ stroke: "#E5E5E5" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 20]}
                  ticks={[0, 5, 10, 15, 20]}
                  tick={{ fill: "#6B6B6B", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(2)}/20`, "Moyenne"]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #E5E5E5",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="moyenne"
                  name="Moyenne / 20"
                  stroke="#F97316"
                  strokeWidth={3}
                  dot={{ r: 6, fill: "#fff", stroke: "#F97316", strokeWidth: 2.5 }}
                  activeDot={{ r: 8, fill: "#C2410C", stroke: "#fff", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-6 rounded-xl bg-page px-5 py-5 text-sm text-ink-secondary">
            Le graphique s'affichera dès que l'étudiant aura des notes sur au moins deux périodes.
          </p>
        )}
      </section>

      {/* Notes par période */}
      <section aria-labelledby="notes-title" className="mt-10">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
          Résultats détaillés
        </p>
        <h2 id="notes-title" className="mt-1 text-2xl font-bold text-ink">
          Notes par période et matière
        </h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {groupedNotes.map(({ periode, notes }) => {
            const moy =
              notes.length > 0
                ? notes.reduce((t, n) => t + n.valeur, 0) / notes.length
                : null;
            return (
              <section
                key={periode}
                className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
              >
                <div className="flex items-center justify-between gap-3 border-b border-border bg-ink px-5 py-4">
                  <h3 className="font-semibold text-surface">{periode}</h3>
                  {moy !== null && (
                    <span className="rounded-full bg-brand px-2.5 py-0.5 text-sm font-bold text-ink tabular-nums">
                      {moy.toFixed(1)}/20
                    </span>
                  )}
                </div>
                {notes.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {notes.map((note) => (
                      <li
                        key={note.id}
                        className="flex items-center justify-between gap-4 px-5 py-3"
                      >
                        <span className="font-medium text-ink-secondary">{note.matiere}</span>
                        <span
                          className={`rounded-lg px-3 py-0.5 text-sm font-bold tabular-nums ${
                            note.valeur >= 10
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-red-50 text-red-800"
                          }`}
                        >
                          {note.valeur}/20
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-5 text-sm text-ink-secondary">
                    Aucune note pour cette période.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </section>

      {/* Absences */}
      <section aria-labelledby="absences-title" className="mt-10">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
          Présence
        </p>
        <h2 id="absences-title" className="mt-1 text-2xl font-bold text-ink">
          Absences par période
        </h2>
        {student.absences.length > 0 ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {periodes.map((periode) => {
              const absPeriode = student.absences.filter((a) => a.periode === periode);
              const injustifiees = absPeriode.filter((a) => a.motif === "injustifiee").length;
              const justifiees = absPeriode.filter((a) => a.motif === "justifiee").length;
              return (
                <section
                  key={periode}
                  className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-ink px-5 py-4">
                    <h3 className="font-semibold text-surface">{periode}</h3>
                    {absPeriode.length > 0 && (
                      <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-surface">
                        {absPeriode.length}
                      </span>
                    )}
                  </div>
                  {absPeriode.length > 0 ? (
                    <div className="p-5">
                      <div className="mb-4 flex gap-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                          {injustifiees} injustifiée{injustifiees > 1 ? "s" : ""}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                          {justifiees} justifiée{justifiees > 1 ? "s" : ""}
                        </span>
                      </div>
                      <ul className="divide-y divide-border border-t border-border pt-3">
                        {absPeriode.map((abs) => (
                          <li
                            key={abs.id}
                            className="flex items-center justify-between py-2 text-sm"
                          >
                            <span className="text-ink-secondary">{formatDate(abs.date)}</span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                abs.motif === "injustifiee"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {abs.motif === "injustifiee" ? "Injustifiée" : "Justifiée"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="px-5 py-5 text-sm text-ink-secondary">
                      Aucune absence enregistrée.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
            <span aria-hidden="true">✓ </span>Aucune absence enregistrée pour cet étudiant.
          </p>
        )}
      </section>

      {/* Alertes */}
      <section aria-labelledby="alerts-title" className="mt-10">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
          Suivi des risques
        </p>
        <h2 id="alerts-title" className="mt-1 text-2xl font-bold text-ink">
          Historique des alertes
        </h2>

        {error && (
          <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 font-medium text-red-800">
            {error}
          </p>
        )}

        {alerts.length > 0 ? (
          <div className="mt-5 space-y-4">
            {alerts.map((alert) => (
              <article
                key={alert.id}
                className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={riskVariant(alert.niveauRisque)}>
                      {alert.niveauRisque === "eleve" ? "Risque élevé" : "Risque moyen"}
                    </Badge>
                    <Badge variant={statusVariant(alert.statut)}>
                      {alert.statut === "active" ? "Active" : "Traitée"}
                    </Badge>
                    <span className="text-sm font-semibold text-ink">{alert.periode}</span>
                  </div>
                  {alert.statut === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={processingId === alert.id}
                      onClick={() => void markAsHandled(alert.id)}
                    >
                      {processingId === alert.id ? "Mise à jour…" : "Marquer comme traitée"}
                    </Button>
                  )}
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
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
                  <div>
                    <dt className="text-sm font-semibold text-ink-secondary">Date</dt>
                    <dd className="mt-1 font-semibold text-ink">{formatDate(alert.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-ink-secondary">Période</dt>
                    <dd className="mt-1 font-semibold text-ink">{alert.periode}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
            <span aria-hidden="true">✓ </span>Aucune alerte dans l'historique de cet étudiant.
          </p>
        )}
      </section>
    </main>
  );
}
