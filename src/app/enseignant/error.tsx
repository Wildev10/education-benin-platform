"use client";

export default function EnseignantError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-2xl font-semibold">L'espace enseignant est indisponible</h1>
        <p className="mt-2 text-lg">Les données n'ont pas pu être chargées. Réessaie dans un instant.</p>
        <button type="button" onClick={reset} className="mt-5 rounded-lg bg-ink px-4 py-2.5 font-semibold text-surface transition hover:bg-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2">Réessayer</button>
      </div>
    </main>
  );
}
