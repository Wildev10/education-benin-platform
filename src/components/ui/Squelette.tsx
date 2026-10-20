import type { ReactNode } from "react";

/**
 * Squelettes de chargement. Ils reprennent la forme et surtout les hauteurs du
 * contenu réel (hauteurs de ligne du texte, champs de 42 px, lignes de
 * tableau…) pour que le remplacement par la page ne décale rien. L'animation
 * (classe .squelette, globals.css) s'arrête si l'utilisateur préfère réduire
 * les animations, et les blocs restent visibles en mode contraste élevé.
 */

/** Bloc animé, purement décoratif. */
export function Bloc({ className = "", sombre = false }: { className?: string; sombre?: boolean }) {
  return <div aria-hidden="true" className={`squelette ${sombre ? "squelette-sombre" : ""} rounded ${className}`} />;
}

/**
 * Une ligne de texte : `hauteur` est la hauteur de ligne du texte imité
 * (h-5 pour text-sm, h-6 pour text-base…), le bloc en occupe les deux tiers.
 */
export function Ligne({
  hauteur = "h-5",
  largeur = "w-32",
  className = "",
  sombre = false,
}: {
  hauteur?: string;
  largeur?: string;
  className?: string;
  sombre?: boolean;
}) {
  return (
    <div className={`flex items-center ${hauteur} ${className}`}>
      <Bloc sombre={sombre} className={`h-[65%] max-w-full ${largeur}`} />
    </div>
  );
}

/** Conteneur de page : même gabarit que les <main> réels, annonce discrète du chargement. */
export function PageSquelette({ libelle = "Chargement", children }: { libelle?: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8" aria-busy="true">
      <p role="status" className="sr-only">
        {libelle}…
      </p>
      {children}
    </main>
  );
}

/** En-tête de page : surtitre, titre (h1), description, bouton éventuel. */
export function SqueletteEntete({
  largeurTitre = "w-72",
  description = true,
  bouton = false,
  className = "max-w-3xl",
}: {
  largeurTitre?: string;
  description?: boolean;
  bouton?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <Ligne largeur="w-36" />
      <Ligne hauteur="h-9 sm:h-10" largeur={largeurTitre} className="mt-2" />
      {description && (
        <>
          <Ligne hauteur="h-8" largeur="w-[28rem]" className="mt-3" />
          {/* Les descriptions passent sur deux lignes à 375 px */}
          <Ligne hauteur="h-8" largeur="w-40" className="sm:hidden" />
        </>
      )}
      {bouton && <Bloc className="mt-5 h-[42px] w-64 max-w-full rounded-lg" />}
    </div>
  );
}

/** Titre de section : surtitre et h2. */
export function SqueletteTitreSection({ largeur = "w-56", className = "" }: { largeur?: string; className?: string }) {
  return (
    <div className={className}>
      <Ligne largeur="w-28" />
      <Ligne hauteur="h-8" largeur={largeur} className="mt-1" />
    </div>
  );
}

/** Carte de chiffre clé (StatCard). */
export function SqueletteCarteStat({ icone = false, sousTitre = false }: { icone?: boolean; sousTitre?: boolean }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Ligne largeur="w-28" />
        {icone && <Bloc className="h-[22px] w-[22px] rounded-md" />}
      </div>
      <Ligne hauteur="h-10" largeur="w-16" className="mt-3" />
      {sousTitre && <Ligne largeur="w-32" className="mt-1.5" />}
    </div>
  );
}

/** Champ de formulaire avec son libellé. */
export function SqueletteChamp({ libelle = "w-24", className = "" }: { libelle?: string; className?: string }) {
  return (
    <div className={className}>
      <Ligne largeur={libelle} className="mb-1.5" />
      <Bloc className="h-[42px] w-full rounded-lg" />
    </div>
  );
}

/**
 * Tableau : en-tête sombre puis lignes alternées. `hauteurLigne` reprend la
 * hauteur des lignes réelles (h-14 pour une ligne de texte avec py-4).
 */
export function SqueletteTableau({
  colonnes,
  lignes = 8,
  hauteurLigne = "h-14",
  hauteurEntete = "h-[52px]",
}: {
  /** Largeur du bloc de chaque colonne, ou { largeur, cellule } pour masquer une colonne selon l'écran */
  colonnes: (string | { largeur: string; cellule: string })[];
  lignes?: number;
  hauteurLigne?: string;
  hauteurEntete?: string;
}) {
  const cellules = (sombre: boolean) =>
    colonnes.map((colonne, j) => {
      const { largeur, cellule } = typeof colonne === "string" ? { largeur: colonne, cellule: "" } : colonne;
      return (
        <div key={j} className={`min-w-0 flex-1 ${cellule}`}>
          <Bloc sombre={sombre} className={`h-3.5 max-w-full ${largeur}`} />
        </div>
      );
    });
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className={`flex items-center gap-5 bg-ink px-5 ${hauteurEntete}`}>{cellules(true)}</div>
      <div className="divide-y divide-border">
        {Array.from({ length: lignes }, (_, i) => (
          <div key={i} className={`flex items-center gap-5 px-5 ${hauteurLigne} ${i % 2 === 1 ? "bg-page" : "bg-surface"}`}>
            {cellules(false)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Barre de pagination (plage, boutons, taille de page). */
export function SquelettePagination() {
  return (
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <Ligne largeur="w-28" />
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <Bloc className="h-10 w-28 rounded-lg" />
        <Bloc className="hidden h-10 w-48 rounded-lg sm:block" />
        <Ligne largeur="w-24" className="sm:hidden" />
        <Bloc className="h-10 w-24 rounded-lg" />
      </div>
      <div className="flex items-center gap-2">
        <Ligne largeur="w-16" />
        <Bloc className="h-[38px] w-16 rounded-lg" />
      </div>
    </div>
  );
}

/** Carte d'alerte : nom et badge, établissement, puis 3 ou 4 indicateurs. */
export function SqueletteCarteAlerte({ colonnes = 4, bouton = false }: { colonnes?: 3 | 4; bouton?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Ligne hauteur="h-7" largeur="w-44" />
            <Bloc className="h-6 w-24 rounded-full" />
          </div>
          <Ligne hauteur="h-6" largeur="w-56" className="mt-1.5" />
        </div>
        {bouton && <Bloc className="h-[42px] w-52 rounded-lg" />}
      </div>
      <div
        className={`mt-5 grid gap-4 border-t border-border pt-5 ${colonnes === 4 ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-3"}`}
      >
        {Array.from({ length: colonnes }, (_, i) => (
          <div key={i}>
            <Ligne largeur="w-20" />
            <Ligne hauteur="h-6" largeur="w-24" className="mt-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Graphique en barres horizontales ; la hauteur est fixée par le conteneur. */
export function SqueletteGraphiqueBarres({ className = "h-64", barres = 5 }: { className?: string; barres?: number }) {
  const largeurs = ["w-4/5", "w-3/5", "w-1/2", "w-2/5", "w-1/4", "w-1/5"];
  return (
    <div aria-hidden="true" className={`flex w-full flex-col justify-around pb-8 ${className}`}>
      {Array.from({ length: barres }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Bloc className="h-3 w-24 shrink-0" />
          <Bloc className={`h-6 rounded-md ${largeurs[i % largeurs.length]}`} />
        </div>
      ))}
    </div>
  );
}

/** Graphique en courbe : quadrillage, tracé et étiquettes de l'axe. */
export function SqueletteGraphiqueLigne({ className = "h-64" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex w-full flex-col ${className}`}>
      <div className="relative min-h-0 flex-1 pl-10">
        <div className="absolute inset-y-0 left-0 flex flex-col justify-between py-1">
          {Array.from({ length: 5 }, (_, i) => (
            <Bloc key={i} className="h-2.5 w-6" />
          ))}
        </div>
        <div className="flex h-full flex-col justify-between">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="border-t border-dashed border-border" />
          ))}
        </div>
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="squelette-trace absolute inset-y-0 right-0 left-10 h-full w-[calc(100%-2.5rem)] text-border"
        >
          <polyline
            points="8,26 50,14 92,20"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex justify-around pt-3 pl-10">
        {Array.from({ length: 3 }, (_, i) => (
          <Bloc key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}

/** Notes par trimestre : deux trimestres repliés, le plus récent ouvert. */
export function SqueletteAccordeon({ notes = 6 }: { notes?: number }) {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex min-h-14 items-center justify-between gap-3 bg-ink px-5 py-3">
            <div className="flex items-center gap-2.5">
              <Bloc sombre className="h-4 w-4" />
              <Bloc sombre className="h-4 w-24" />
              <Bloc sombre className="h-3.5 w-14" />
            </div>
            <Bloc sombre className="h-7 w-16 rounded-full" />
          </div>
          {i === 2 && (
            <div className="-mb-px grid gap-x-10 px-5 sm:grid-cols-2">
              {Array.from({ length: notes }, (_, j) => (
                <div key={j} className="flex items-center justify-between gap-4 border-b border-border py-3">
                  <Ligne hauteur="h-6" largeur="w-32" />
                  <Bloc className="h-6 w-14 rounded-lg" />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Carte récapitulative par trimestre (absences) : en-tête sombre et deux lignes. */
export function SqueletteCarteTrimestre({ lignes = 2 }: { lignes?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex h-[61px] items-center justify-between gap-3 bg-ink px-5">
        <Bloc sombre className="h-4 w-24" />
        <Bloc sombre className="h-7 w-24 rounded-full" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: lignes }, (_, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3">
            <Ligne hauteur="h-6" largeur="w-24" />
            <Bloc className="h-4 w-6" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Liste paginée des élèves (StudentDirectory) : titre, recherche, filtres, tableau, pagination. */
export function SqueletteRepertoireEleves({ admin = false }: { admin?: boolean }) {
  return (
    <section className="mt-8">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <SqueletteTitreSection largeur="w-32" />
        <Ligne largeur="w-24" />
      </div>
      <div className="border-b border-border py-5">
        <Bloc className="h-[42px] w-full max-w-md rounded-lg" />
      </div>
      <div className={`grid gap-4 border-b border-border py-5 ${admin ? "sm:grid-cols-2" : "sm:max-w-sm"}`}>
        {admin && <SqueletteChamp libelle="w-28" className="flex flex-col" />}
        <SqueletteChamp libelle="w-16" className="flex flex-col" />
      </div>
      <div className="mt-5">
        <SqueletteTableau
          colonnes={admin ? ["w-24", "w-20", "w-40", "w-24", "w-28"] : ["w-24", "w-20", "w-40", "w-24"]}
          lignes={10}
        />
      </div>
      <SquelettePagination />
    </section>
  );
}

/** Page Alertes (admin, directeur, enseignant) : filtres, nombre, cartes, pagination. */
export function SqueletteListeAlertes() {
  return (
    <PageSquelette libelle="Chargement des alertes">
      <SqueletteEntete largeurTitre="w-40" />
      <div className="mt-8">
        <div className="flex flex-wrap items-center gap-3">
          <Bloc className="h-[42px] w-28 rounded-lg md:hidden" />
          <div className="ml-auto flex flex-wrap gap-2">
            <Bloc className="h-[42px] w-40 rounded-lg" />
            <Bloc className="h-[42px] w-40 rounded-lg" />
          </div>
        </div>
        <div className="mt-4 hidden rounded-[14px] border border-border bg-surface p-4 shadow-sm sm:p-5 md:block">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SqueletteChamp libelle="w-36" className="sm:col-span-2 lg:col-span-4" />
            {["w-32", "w-12", "w-14", "w-28", "w-40", "w-16"].map((libelle, i) => (
              <SqueletteChamp key={i} libelle={libelle} />
            ))}
          </div>
        </div>
        <div className="mt-6">
          <Ligne largeur="w-20" />
          <div className="mt-4 grid gap-4">
            {[0, 1, 2, 3].map((i) => (
              <SqueletteCarteAlerte key={i} />
            ))}
          </div>
          <SquelettePagination />
        </div>
      </div>
    </PageSquelette>
  );
}

/** Page Absences (admin, directeur, enseignant) : filtres, nombre, tableau, pagination. */
export function SqueletteListeAbsences() {
  return (
    <PageSquelette libelle="Chargement des absences">
      <SqueletteEntete largeurTitre="w-48" />
      <div className="mt-8">
        <div className="rounded-[14px] border border-border bg-surface p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SqueletteChamp libelle="w-36" className="sm:col-span-2 lg:col-span-4" />
            {["w-16", "w-12", "w-28", "w-28"].map((libelle, i) => (
              <SqueletteChamp key={i} libelle={libelle} />
            ))}
          </div>
        </div>
        <div className="mt-6">
          <Ligne largeur="w-24" />
          <div className="mt-4">
            <SqueletteTableau colonnes={["w-24", "w-36", "w-40", "w-36", "w-20"]} lignes={10} hauteurLigne="h-[71px]" />
          </div>
          <SquelettePagination />
        </div>
      </div>
    </PageSquelette>
  );
}
