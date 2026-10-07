"use client";

import Link from "next/link";

export default function StudentDetailError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
        <span aria-hidden="true" className="text-5xl">⚠</span>
        <h1 className="mt-4 text-2xl font-bold text-red-900">
          Fiche étudiant indisponible
        </h1>
        <p className="mt-3 text-lg text-red-800">
          Les données n'ont pas pu être chargées. Vérifiez votre connexion puis réessayez.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-ink px-6 py-3 font-semibold text-surface transition hover:bg-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2"
          >
            Réessayer
          </button>
          <Link
            href="/enseignant"
            className="rounded-lg border border-border bg-surface px-6 py-3 font-semibold text-ink-secondary transition hover:border-brand hover:bg-brand-light hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2"
          >
            Retour à la liste
          </Link>
        </div>
      </div>
    </main>
  );
}
