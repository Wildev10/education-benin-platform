"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId } from "react";
import {
  TAILLES_PAGE,
  libellePlage,
  numerosDePages,
  urlListe,
  type TaillePage,
} from "@/lib/pagination";

const boutonCls =
  "inline-flex min-h-10 tactile:min-h-11 tactile:min-w-11 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark";
const actifCls = `${boutonCls} border-border bg-surface text-ink hover:border-brand hover:bg-brand-light`;
const inactifCls = `${boutonCls} cursor-not-allowed border-border bg-page text-ink-secondary/60`;

/**
 * Navigation entre les pages d'une liste paginée côté serveur. Les liens
 * gardent les filtres (`requete`) et la taille ; changer de taille revient à
 * la page 1. Sur mobile, les numéros laissent la place à « Page 2 sur 8 ».
 */
export function Pagination({
  chemin,
  requete,
  page,
  taille,
  total,
  nbPages,
  libelle = "Pagination",
}: {
  chemin: string;
  /** Filtres actifs, sans page ni taille */
  requete: string;
  page: number;
  taille: TaillePage;
  total: number;
  nbPages: number;
  libelle?: string;
}) {
  const router = useRouter();
  const id = useId();
  const filtres = new URLSearchParams(requete);
  const lien = (n: number) => urlListe(chemin, filtres, taille, n);

  return (
    <nav
      aria-label={libelle}
      className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <p className="text-sm text-ink-secondary" aria-live="polite">
        <span className="font-semibold tabular-nums text-ink">{libellePlage({ page, taille, total })}</span>
      </p>

      {nbPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-start">
          {page > 1 ? (
            <Link href={lien(page - 1)} className={actifCls} rel="prev">
              <span aria-hidden="true">‹</span>&nbsp;Précédent
            </Link>
          ) : (
            <span className={inactifCls} aria-disabled="true">
              <span aria-hidden="true">‹</span>&nbsp;Précédent
            </span>
          )}

          <ul className="hidden items-center gap-1 sm:flex">
            {numerosDePages(page, nbPages).map((n, i) =>
              n === "…" ? (
                <li key={`ellipse-${i}`} aria-hidden="true" className="px-1 text-ink-secondary">
                  …
                </li>
              ) : (
                <li key={n}>
                  {n === page ? (
                    <span
                      aria-current="page"
                      className={`${boutonCls} min-w-10 border-brand bg-brand text-ink`}
                    >
                      <span className="sr-only">Page </span>
                      {n}
                    </span>
                  ) : (
                    <Link href={lien(n)} className={`${actifCls} min-w-10`}>
                      <span className="sr-only">Page </span>
                      {n}
                    </Link>
                  )}
                </li>
              )
            )}
          </ul>
          <p className="text-sm font-semibold tabular-nums text-ink sm:hidden">
            Page {page} sur {nbPages}
          </p>

          {page < nbPages ? (
            <Link href={lien(page + 1)} className={actifCls} rel="next">
              Suivant&nbsp;<span aria-hidden="true">›</span>
            </Link>
          ) : (
            <span className={inactifCls} aria-disabled="true">
              Suivant&nbsp;<span aria-hidden="true">›</span>
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <label htmlFor={`${id}-taille`} className="text-sm font-semibold text-ink">
          Par page
        </label>
        <select
          id={`${id}-taille`}
          value={taille}
          onChange={(e) => router.push(urlListe(chemin, filtres, Number(e.target.value) as TaillePage))}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark"
        >
          {TAILLES_PAGE.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
    </nav>
  );
}
