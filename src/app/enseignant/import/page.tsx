"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/lib/swal";

type LigneErreur = { ligne: number; contenu: string; raison: string };
type Rapport = { total: number; importees: number; erreurs: LigneErreur[]; alertesCreees: number };

const CSV_MODELE = [
  "email_etudiant,matiere,valeur,periode,anneeScolaire",
  "etudiant@edutech.bj,Mathématiques,14.5,Trimestre 1,2025-2026",
  "etudiant@edutech.bj,Français,12,Trimestre 2,2025-2026",
].join("\n");

function telechargerModele() {
  const blob = new Blob([CSV_MODELE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modele-notes.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportNotesPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [erreurGlobale, setErreurGlobale] = useState("");
  const [dragOver, setDragOver] = useState(false);

  function selectionnerFichier(f: File | undefined | null) {
    if (!f) return;
    setFichier(f);
    setRapport(null);
    setErreurGlobale("");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    selectionnerFichier(e.dataTransfer.files[0]);
  }

  async function handleImport() {
    if (!fichier) return;
    setLoading(true);
    setRapport(null);
    setErreurGlobale("");

    try {
      const fd = new FormData();
      fd.append("fichier", fichier);
      const res = await fetch("/api/notes/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setErreurGlobale(data.error ?? "L'import a échoué.");
        void Toast.fire({ icon: "error", title: "Erreur lors de l'import." });
        return;
      }
      const r = data as Rapport;
      setRapport(r);
      void Toast.fire({ icon: "success", title: `Import terminé : ${r.importees} notes importées.` });
    } catch {
      setErreurGlobale("La requête a échoué. Vérifiez votre connexion.");
      void Toast.fire({ icon: "error", title: "Erreur lors de l'import." });
    } finally {
      setLoading(false);
    }
  }

  const toutOk = rapport && rapport.erreurs.length === 0;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">Évaluation</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Importer des notes</h1>
      <p className="mt-2 text-ink-secondary">Chargez un fichier CSV pour créer plusieurs notes en une seule opération.</p>

      {/* Bouton modèle */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={telechargerModele}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Télécharger le modèle CSV
        </Button>
        <p className="text-sm text-ink-secondary">Format : <code className="rounded bg-page px-1 py-px text-xs">email_etudiant,matiere,valeur,periode,anneeScolaire</code></p>
      </div>

      {/* Zone de dépôt */}
      <div className="mt-6">
        <label htmlFor="fichier-csv" className="mb-2 block text-sm font-semibold text-ink">
          Fichier CSV <span className="font-normal text-ink-secondary">(max 1 Mo)</span>
        </label>
        <div
          ref={dropZoneRef}
          role="button"
          tabIndex={0}
          aria-label="Zone de dépôt du fichier CSV. Cliquez ou glissez-déposez un fichier."
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 ${
            dragOver
              ? "border-brand bg-brand-light"
              : fichier
                ? "border-emerald-400 bg-emerald-50"
                : "border-border bg-page hover:border-brand/50 hover:bg-brand-light/30"
          }`}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="mb-3 text-ink-secondary">
            <path d="M6 22v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2M16 6v14M10 12l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {fichier ? (
            <>
              <p className="font-semibold text-ink">{fichier.name}</p>
              <p className="mt-1 text-sm text-ink-secondary">{(fichier.size / 1024).toFixed(1)} Ko · cliquez pour changer</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-ink">Glissez-déposez votre fichier CSV ici</p>
              <p className="mt-1 text-sm text-ink-secondary">ou cliquez pour parcourir</p>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          id="fichier-csv"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label="Sélectionner un fichier CSV"
          onChange={(e) => selectionnerFichier(e.target.files?.[0])}
        />
      </div>

      {erreurGlobale && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {erreurGlobale}
        </p>
      )}

      {/* Bouton import */}
      <Button
        type="button"
        disabled={!fichier || loading}
        onClick={handleImport}
        className="mt-5 w-full justify-center py-3 sm:w-auto sm:px-8"
      >
        {loading ? "Import en cours…" : "Importer"}
      </Button>

      {/* Rapport */}
      {rapport && (
        <section aria-labelledby="rapport-titre" className="mt-8">
          <h2 id="rapport-titre" className="text-xl font-semibold text-ink">Rapport d'import</h2>

          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className={`rounded-2xl border p-4 ${toutOk ? "border-emerald-200 bg-emerald-50" : "border-border bg-surface"}`}>
              <dt className="text-sm font-semibold text-ink-secondary">Notes importées</dt>
              <dd className="mt-1 text-3xl font-semibold text-ink">
                {rapport.importees}
                <span className="ml-1 text-base font-normal text-ink-secondary">/ {rapport.total}</span>
              </dd>
            </div>
            <div className={`rounded-2xl border p-4 ${rapport.alertesCreees > 0 ? "border-amber-300 bg-amber-50" : "border-border bg-surface"}`}>
              <dt className="text-sm font-semibold text-ink-secondary">Alertes déclenchées</dt>
              <dd className="mt-1 flex items-center gap-2 text-3xl font-semibold text-ink">
                {rapport.alertesCreees}
                {rapport.alertesCreees > 0 && (
                  <span aria-label="Avertissement" className="text-amber-600">
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                      <path d="M11 2L2 19h18L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M11 9v4M11 15.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </span>
                )}
              </dd>
            </div>
            <div className={`rounded-2xl border p-4 ${rapport.erreurs.length > 0 ? "border-red-200 bg-red-50" : "border-border bg-surface"}`}>
              <dt className="text-sm font-semibold text-ink-secondary">Lignes en erreur</dt>
              <dd className="mt-1 text-3xl font-semibold text-ink">{rapport.erreurs.length}</dd>
            </div>
          </dl>

          {rapport.erreurs.length > 0 && (
            <div className="mt-6">
              <h3 className="text-base font-semibold text-ink">Détail des erreurs</h3>
              <div className="mt-3 overflow-hidden rounded-2xl border border-red-200 bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-red-50 text-left">
                      <th scope="col" className="px-4 py-3 font-semibold text-red-900">Ligne</th>
                      <th scope="col" className="hidden px-4 py-3 font-semibold text-red-900 sm:table-cell">Contenu</th>
                      <th scope="col" className="px-4 py-3 font-semibold text-red-900">Raison</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {rapport.erreurs.map((err) => (
                      <tr key={err.ligne}>
                        <td className="px-4 py-3 font-semibold text-red-800">{err.ligne}</td>
                        <td className="hidden max-w-xs truncate px-4 py-3 font-mono text-xs text-ink-secondary sm:table-cell">{err.contenu}</td>
                        <td className="px-4 py-3 text-red-700">{err.raison}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {toutOk && (
            <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              <span aria-hidden="true">✓ </span>Toutes les notes ont été importées avec succès.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
