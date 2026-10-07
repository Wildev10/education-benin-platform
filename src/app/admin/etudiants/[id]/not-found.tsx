import Link from "next/link";

export default function AdminStudentNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <span aria-hidden="true" className="text-5xl">🔍</span>
        <h1 className="mt-4 text-2xl font-bold text-amber-950">Étudiant introuvable</h1>
        <p className="mt-3 text-lg text-amber-900">
          Cette fiche n'existe pas ou n'est plus disponible.
        </p>
        <Link
          href="/admin/etudiants"
          className="mt-6 inline-block rounded-lg bg-ink px-6 py-3 font-semibold text-surface transition hover:bg-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2"
        >
          Retour à la liste
        </Link>
      </div>
    </main>
  );
}
