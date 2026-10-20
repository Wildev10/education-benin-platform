import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { accueilDuRole } from "@/lib/accueil";

export const metadata: Metadata = {
  title: "Page introuvable — EduTech Bénin",
};

/**
 * Page 404 unique : adresse inconnue, fiche élève inexistante ou hors du
 * périmètre de l'utilisateur. Le texte est le même dans tous les cas, pour ne
 * jamais laisser deviner qu'un élève existe.
 */
export default async function NotFound() {
  const session = await auth().catch(() => null);
  const accueil = accueilDuRole(session?.user?.role);

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-page px-5 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="flex items-center justify-center gap-3">
          <Image src="/armoiries-benin.png" alt="Armoiries du Bénin" width={48} height={48} priority className="shrink-0" />
          <div className="text-left">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-ink">EduTech Bénin</p>
            <p className="text-xs text-ink-secondary">Plateforme de suivi scolaire</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface px-6 py-10 shadow-sm sm:px-10">
          <p aria-hidden="true" className="text-6xl font-bold tracking-tight text-brand tabular-nums sm:text-7xl">
            404
          </p>
          <h1 className="mt-4 text-2xl font-bold text-ink sm:text-3xl">Page introuvable</h1>
          <p className="mt-3 text-lg leading-8 text-ink-secondary">
            L&apos;adresse est peut-être erronée, ou ce contenu n&apos;est pas accessible depuis votre compte.
          </p>
          <Link
            href={accueil ?? "/"}
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-6 py-3 font-semibold text-ink transition hover:bg-brand-dark hover:text-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {accueil ? "Retour à mon espace" : "Retour à l'accueil"}
          </Link>
        </div>
      </div>
    </main>
  );
}
