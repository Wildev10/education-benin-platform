"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast, Confirm } from "@/lib/swal";
import { useHorsLigne } from "@/components/pwa/PwaProvider";
import { MessageEcritureHorsLigne, TITRE_HORS_LIGNE } from "@/components/pwa/BandeauHorsLigne";
import { AccordeonTrimestres } from "@/components/notes/AccordeonTrimestres";
import { TRIMESTRES as periodes, grouperNotesParTrimestre } from "@/lib/notes-trimestres";
import { redirigerVersConnexion } from "@/lib/session-expiree";
import { IconeAlerte } from "@/components/ui/Icones";

type Note = {
  id: string;
  matiere: string;
  valeur: number;
  periode: string;
  anneeScolaire: string;
};

type Absence = {
  id: string;
  date: string;
  motif: string;
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const selectCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark";
const inputCls =
  "w-full rounded-lg border border-border px-3 py-2.5 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark";
const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

export default function StudentDetail({
  etudiantId,
  initialNotes,
  initialAbsences,
  peutSupprimerAbsence = false,
}: {
  etudiantId: string;
  initialNotes: Note[];
  initialAbsences: Absence[];
  /** Même règle que DELETE /api/absences/[id] (le directeur ne supprime pas) */
  peutSupprimerAbsence?: boolean;
}) {
  const horsLigne = useHorsLigne();
  const [notes, setNotes] = useState(initialNotes);
  const [matiere, setMatiere] = useState(matieres[0]);
  const [valeur, setValeur] = useState("");
  const [periode, setPeriode] = useState<string>(periodes[0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [alerteCreee, setAlerteCreee] = useState(false);
  const [derniereSaisie, setDerniereSaisie] = useState<{ id: string; periode: string } | null>(null);

  const [absences, setAbsences] = useState(initialAbsences);
  const [absDate, setAbsDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [absMotif, setAbsMotif] = useState("injustifiee");
  const [absPeriode, setAbsPeriode] = useState<string>(periodes[0]);
  const [absLoading, setAbsLoading] = useState(false);
  const [absMessage, setAbsMessage] = useState("");
  const [absError, setAbsError] = useState("");
  const [absAlerteCreee, setAbsAlerteCreee] = useState(false);

  const notesParPeriode = useMemo(() => grouperNotesParTrimestre(notes), [notes]);

  const absencesParPeriode = useMemo(
    () => periodes.map((nom) => ({ nom, absences: absences.filter((a) => a.periode === nom) })),
    [absences]
  );

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
      if (response.status === 401) { redirigerVersConnexion(); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossible d'enregistrer la note.");
      setNotes((current) => [data, ...current]);
      setDerniereSaisie({ id: data.id, periode: data.periode });
      setMessage(`Note de ${data.valeur}/20 enregistrée en ${data.matiere}.`);
      setAlerteCreee(data.alerteCreee === true);
      setValeur("");
      void Toast.fire({ icon: "success", title: "Note enregistrée avec succès." });
      if (data.alerteCreee === true) {
        void Toast.fire({ icon: "warning", title: "Alerte déclenchée pour cet élève.", timer: 6000 });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      void Toast.fire({ icon: "error", title: "Erreur lors de l'enregistrement de la note." });
    } finally {
      setLoading(false);
    }
  }

  async function handleAbsenceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAbsLoading(true);
    setAbsMessage("");
    setAbsError("");
    setAbsAlerteCreee(false);

    try {
      const response = await fetch("/api/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etudiantId,
          date: absDate,
          motif: absMotif,
          periode: absPeriode,
          anneeScolaire: "2025-2026",
        }),
      });
      if (response.status === 401) { redirigerVersConnexion(); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossible d'enregistrer l'absence.");
      setAbsences((current) => [
        { id: data.absence.id, date: data.absence.date, motif: data.absence.motif, periode: data.absence.periode, anneeScolaire: data.absence.anneeScolaire },
        ...current,
      ]);
      setAbsMessage(`Absence du ${formatDate(absDate)} enregistrée.`);
      setAbsAlerteCreee(data.alerteCreee === true);
      setAbsDate(new Date().toISOString().slice(0, 10));
      void Toast.fire({ icon: "success", title: "Absence enregistrée." });
    } catch (e) {
      setAbsError(e instanceof Error ? e.message : "Une erreur est survenue.");
      void Toast.fire({ icon: "error", title: "Erreur lors de l'enregistrement." });
    } finally {
      setAbsLoading(false);
    }
  }

  async function handleDeleteAbsence(id: string) {
    const result = await Confirm.fire({
      title: "Êtes-vous sûr ?",
      text: "Cette action est irréversible.",
      icon: "warning",
      showCancelButton: true,
    });
    if (!result.isConfirmed) return;
    try {
      const response = await fetch(`/api/absences/${id}`, { method: "DELETE" });
      if (response.status === 401) { redirigerVersConnexion(); return; }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Impossible de supprimer l'absence.");
      }
      setAbsences((current) => current.filter((a) => a.id !== id));
      void Toast.fire({ icon: "success", title: "Absence supprimée." });
    } catch (e) {
      void Toast.fire({ icon: "error", title: e instanceof Error ? e.message : "Erreur lors de l'enregistrement." });
    }
  }

  return (
    <div className="space-y-12">
      {/* ── Notes ──────────────────────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Liste des notes */}
        <section aria-labelledby="notes-title">
          <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
                Historique
              </p>
              <h2 id="notes-title" className="mt-1 text-2xl font-bold text-ink">
                Notes par période
              </h2>
            </div>
            <span className="rounded-full border border-border bg-page px-3 py-1 text-sm font-semibold text-ink-secondary">
              {notes.length} note{notes.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-5">
            <AccordeonTrimestres
              groupes={notesParPeriode}
              derniereSaisie={derniereSaisie}
              libelleVide="Aucune note enregistrée."
            />
          </div>
        </section>

        {/* Formulaire note */}
        <section
          aria-labelledby="new-note-title"
          className="h-fit rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
            Évaluation
          </p>
          <h2 id="new-note-title" className="mt-1 text-2xl font-bold text-ink">
            Saisir une note
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Année scolaire :{" "}
            <strong className="text-ink">2025-2026</strong>
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="matiere" className={labelCls}>Matière</label>
              <select
                id="matiere"
                value={matiere}
                onChange={(e) => setMatiere(e.target.value)}
                className={selectCls}
              >
                {matieres.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="valeur" className={labelCls}>Note sur 20</label>
              <input
                id="valeur"
                name="valeur"
                type="number"
                min="0"
                max="20"
                step="0.01"
                required
                value={valeur}
                onChange={(e) => setValeur(e.target.value)}
                className={inputCls}
                placeholder="ex. 14.5"
              />
            </div>
            <div>
              <label htmlFor="periode" className={labelCls}>Période</label>
              <select
                id="periode"
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
                className={selectCls}
              >
                {periodes.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <MessageEcritureHorsLigne />
            <Button
              type="submit"
              disabled={loading || horsLigne}
              title={horsLigne ? TITRE_HORS_LIGNE : undefined}
              className="w-full justify-center py-3"
            >
              {loading ? "Enregistrement…" : "Enregistrer la note"}
            </Button>
          </form>

          <div aria-live="polite" className="mt-4 space-y-3">
            {message && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                {message}
              </p>
            )}
            {alerteCreee && (
              <div
                role="alert"
                className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              >
                <IconeAlerte taille={18} className="mt-0.5 text-amber-700" />
                <p>
                  <strong>Alerte déclenchée.</strong> Une baisse de résultats a été détectée.
                </p>
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                {error}
              </p>
            )}
          </div>

          <Link
            href="/enseignant"
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary shadow-sm transition hover:border-brand hover:bg-brand-light hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Retour à la liste
          </Link>
        </section>
      </div>

      {/* ── Absences ───────────────────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Liste des absences */}
        <section aria-labelledby="absences-title">
          <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
                Présence
              </p>
              <h2 id="absences-title" className="mt-1 text-2xl font-bold text-ink">
                Absences par période
              </h2>
            </div>
            <span className="rounded-full border border-border bg-page px-3 py-1 text-sm font-semibold text-ink-secondary">
              {absences.length} absence{absences.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-5 space-y-4">
            {absencesParPeriode.map((groupe) => (
              <section
                key={groupe.nom}
                className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
              >
                <div className="flex items-center justify-between gap-3 border-b border-border bg-ink px-5 py-3.5">
                  <h3 className="font-semibold text-surface">{groupe.nom}</h3>
                  {groupe.absences.length > 0 && (
                    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-surface">
                      {groupe.absences.length}
                    </span>
                  )}
                </div>
                {groupe.absences.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {groupe.absences.map((abs) => (
                      <li
                        key={abs.id}
                        className="flex items-center justify-between gap-4 px-5 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              abs.motif === "injustifiee"
                                ? "bg-red-100 text-red-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {abs.motif === "injustifiee" ? "Injustifiée" : "Justifiée"}
                          </span>
                          <span className="text-sm text-ink-secondary">
                            {formatDate(abs.date)}
                          </span>
                        </div>
                        {peutSupprimerAbsence && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void handleDeleteAbsence(abs.id)}
                            disabled={horsLigne}
                            title={horsLigne ? TITRE_HORS_LIGNE : undefined}
                            aria-label={`Supprimer l'absence du ${formatDate(abs.date)}`}
                          >
                            Supprimer
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-5 text-sm text-ink-secondary">
                    Aucune absence enregistrée.
                  </p>
                )}
              </section>
            ))}
          </div>
        </section>

        {/* Formulaire absence */}
        <section
          aria-labelledby="new-absence-title"
          className="h-fit rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
            Saisie rapide
          </p>
          <h2 id="new-absence-title" className="mt-1 text-2xl font-bold text-ink">
            Enregistrer une absence
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Année scolaire : <strong className="text-ink">2025-2026</strong>
          </p>

          <form onSubmit={handleAbsenceSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="abs-date" className={labelCls}>Date</label>
              <input
                id="abs-date"
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={absDate}
                onChange={(e) => setAbsDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="abs-motif" className={labelCls}>Motif</label>
              <select
                id="abs-motif"
                value={absMotif}
                onChange={(e) => setAbsMotif(e.target.value)}
                className={selectCls}
              >
                <option value="injustifiee">Injustifiée</option>
                <option value="justifiee">Justifiée</option>
              </select>
            </div>
            <div>
              <label htmlFor="abs-periode" className={labelCls}>Période</label>
              <select
                id="abs-periode"
                value={absPeriode}
                onChange={(e) => setAbsPeriode(e.target.value)}
                className={selectCls}
              >
                {periodes.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <MessageEcritureHorsLigne />
            <Button
              type="submit"
              disabled={absLoading || horsLigne}
              title={horsLigne ? TITRE_HORS_LIGNE : undefined}
              className="w-full justify-center py-3"
            >
              {absLoading ? "Enregistrement…" : "Enregistrer l'absence"}
            </Button>
          </form>

          <div aria-live="polite" className="mt-4 space-y-3">
            {absMessage && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                {absMessage}
              </p>
            )}
            {absAlerteCreee && (
              <div
                role="alert"
                className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              >
                <IconeAlerte taille={18} className="mt-0.5 text-amber-700" />
                <p>
                  <strong>Alerte déclenchée.</strong> Nombre élevé d&apos;absences injustifiées.
                </p>
              </div>
            )}
            {absError && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                {absError}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
