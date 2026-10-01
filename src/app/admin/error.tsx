"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-2xl font-bold">Le tableau de bord est indisponible</h1>
        <p className="mt-2 text-lg">Les données n’ont pas pu être chargées. Réessaie dans un instant.</p>
        <button type="button" onClick={reset} className="mt-5 rounded-lg bg-red-800 px-4 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2">Réessayer</button>
      </div>
    </main>
  );
}
