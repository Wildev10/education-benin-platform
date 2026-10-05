import Link from "next/link";

export default function AdminStudentNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <h1 className="text-2xl font-semibold">Étudiant introuvable</h1>
        <p className="mt-2 text-lg">Cette fiche n'existe pas ou n'est plus disponible.</p>
        <Link href="/admin/etudiants" className="mt-5 inline-block rounded-lg bg-ink px-4 py-2.5 font-semibold text-surface transition hover:bg-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2">Retour à la liste</Link>
      </div>
    </main>
  );
}
