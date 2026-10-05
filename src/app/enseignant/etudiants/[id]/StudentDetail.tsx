"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type Note = {
  id: string;
  matiere: string;
  valeur: number;
  periode: string;
  anneeScolaire: string;
};

const matieres = [
  "Mathématiques",
  "Physique-Chimie",
  "SVT",
  "Français",
  "Anglais",
  "Histoire-Géo",
];

const periodes = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];

export default function StudentDetail({
  etudiantId,
  initialNotes,
}: {
  etudiantId: string;
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [matiere, setMatiere] = useState(matieres[0]);
  const [valeur, setValeur] = useState("");
  const [periode, setPeriode] = useState(periodes[0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [alerteCreee, setAlerteCreee] = useState(false);

  const notesParPeriode = useMemo(() => {
    return periodes.map((nom) => ({
      nom,
      notes: notes.filter((note) => note.periode === nom),
    }));
  }, [notes]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    setAlerteCreee(false);

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etudiantId,
          matiere,
          valeur: Number(valeur),
          periode,
          anneeScolaire: "2025-2026",
        }),
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Impossible d'enregistrer la note.");
      }

      setNotes((current) => [data, ...current]);
      setMessage(`Note de ${data.valeur}/20 enregistrée en ${data.matiere}.`);
      setAlerteCreee(data.alerteCreee === true);
      setValeur("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section aria-labelledby="notes-title">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">Historique</p>
            <h2 id="notes-title" className="mt-1 text-2xl font-semibold text-ink">Notes par période</h2>
          </div>
          <span className="rounded-full border border-border bg-page px-3 py-1 text-sm font-semibold text-ink-secondary">
            {notes.length} note{notes.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="mt-5 space-y-4">
          {notesParPeriode.map((groupe) => (
            <section key={groupe.nom} className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <h3 className="border-b border-border bg-ink px-5 py-3 font-semibold text-surface">{groupe.nom}</h3>
              {groupe.notes.length > 0 ? (
                <ul className="divide-y divide-border">
                  {groupe.notes.map((note) => (
                    <li key={note.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <span className="font-medium text-ink-secondary">{note.matiere}</span>
                      <span className="rounded-md bg-brand-light px-3 py-1 font-semibold text-brand-dark">{note.valeur}/20</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-ink-secondary">Aucune note enregistrée.</p>
              )}
            </section>
          ))}
        </div>
      </section>

      <section aria-labelledby="new-note-title" className="h-fit rounded-xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">Évaluation</p>
        <h2 id="new-note-title" className="mt-1 text-2xl font-semibold text-ink">Saisir une note</h2>
        <p className="mt-2 text-ink-secondary">Année scolaire : <strong className="text-ink">2025-2026</strong></p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label htmlFor="matiere" className="mb-2 block text-sm font-semibold text-ink">Matière</label>
            <select id="matiere" value={matiere} onChange={(event) => setMatiere(event.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark">
              {matieres.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="valeur" className="mb-2 block text-sm font-semibold text-ink">Note sur 20</label>
            <input id="valeur" name="valeur" type="number" min="0" max="20" step="0.01" required value={valeur} onChange={(event) => setValeur(event.target.value)} className="w-full rounded-lg border border-border px-3 py-2.5 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark" />
          </div>
          <div>
            <label htmlFor="periode" className="mb-2 block text-sm font-semibold text-ink">Période</label>
            <select id="periode" value={periode} onChange={(event) => setPeriode(event.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark">
              {periodes.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-ink transition hover:bg-brand-dark hover:text-surface focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? "Enregistrement…" : "Enregistrer la note"}
          </button>
        </form>

        <div aria-live="polite" className="mt-5 space-y-3">
          {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 font-medium text-emerald-800">{message}</p>}
          {alerteCreee && (
            <div role="alert" className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 font-semibold text-surface">!</span>
              <p><strong>Alerte déclenchée.</strong> Une baisse de résultats a été détectée pour cet étudiant.</p>
            </div>
          )}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 font-medium text-red-800">{error}</p>}
        </div>
        <Link href="/enseignant" className="mt-6 inline-block text-sm font-semibold text-brand-dark underline underline-offset-4 hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand-dark">Retour à la liste</Link>
      </section>
    </div>
  );
}
