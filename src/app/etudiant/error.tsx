"use client";

export default function EtudiantError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
        <span aria-hidden="true" className="text-5xl">⚠</span>
        <h1 className="mt-4 text-2xl font-bold text-red-900">
          Ton espace est indisponible
        </h1>
        <p className="mt-3 text-lg text-red-800">
          Les données n'ont pas pu être chargées. Vérifie ta connexion puis réessaie.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-ink px-6 py-3 font-semibold text-surface transition hover:bg-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2"
        >
          Réessayer
        </button>
      </div>
    </main>
  );
}
