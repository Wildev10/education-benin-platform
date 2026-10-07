import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-page px-6 py-16 text-center">
      <div className="rounded-2xl border border-border bg-surface p-10 shadow-sm">
        <p aria-hidden="true" className="text-7xl font-bold text-brand">404</p>
        <h1 className="mt-4 text-2xl font-bold text-ink">Page introuvable</h1>
        <p className="mt-3 text-lg text-ink-secondary">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <Link
          href="/"
          className="mt-7 inline-block rounded-lg bg-brand px-6 py-3 font-semibold text-ink transition hover:bg-brand-dark hover:text-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2"
        >
          Retour à l'accueil
        </Link>
      </div>
    </main>
  );
}
