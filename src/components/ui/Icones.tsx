import type { ReactNode } from "react";

/**
 * Icônes au trait du site : même grille (24), même épaisseur, couleur du texte
 * (currentColor, donc blanc en contraste élevé). Décoratives par défaut
 * (aria-hidden) ; avec `titre`, elles deviennent une image nommée.
 */
type ProprietesIcone = { taille?: number; className?: string; titre?: string };

function Icone({ taille = 20, className = "", titre, children }: ProprietesIcone & { children: ReactNode }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      {...(titre ? { role: "img", "aria-label": titre } : { "aria-hidden": true, focusable: false })}
    >
      {children}
    </svg>
  );
}

/** Alerte : triangle et point d'exclamation */
export const IconeAlerte = (p: ProprietesIcone) => (
  <Icone {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Icone>
);

/** Validé : coche dans un cercle */
export const IconeValide = (p: ProprietesIcone) => (
  <Icone {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </Icone>
);

/** Document PDF */
export const IconeDocument = (p: ProprietesIcone) => (
  <Icone {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icone>
);

/** Tableur (Excel) */
export const IconeTableur = (p: ProprietesIcone) => (
  <Icone {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M3 15h18M9 4v16" />
  </Icone>
);

/** Établissement scolaire */
export const IconeEtablissement = (p: ProprietesIcone) => (
  <Icone {...p}>
    <path d="M2 10 12 4l10 6" />
    <path d="M4 10v10h16V10M9 20v-5h6v5" />
  </Icone>
);

/** Cloche (notifications) */
export const IconeCloche = (p: ProprietesIcone) => (
  <Icone {...p}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </Icone>
);

/** Hors ligne : signal barré */
export const IconeHorsLigne = (p: ProprietesIcone) => (
  <Icone {...p}>
    <path d="m2 2 20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.3-1.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-11.3-3.8M12 20h.01" />
  </Icone>
);

/** Évolution (courbe) : suivi des résultats */
export const IconeEvolution = (p: ProprietesIcone) => (
  <Icone {...p}>
    <path d="M3 3v18h18" />
    <path d="m7 15 4-4 3 3 5-6" />
  </Icone>
);

/** Règle (liste à cocher) : détection par règles explicites */
export const IconeRegles = (p: ProprietesIcone) => (
  <Icone {...p}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" />
  </Icone>
);

/** Vue d'ensemble (grille) : niveau national */
export const IconeVueEnsemble = (p: ProprietesIcone) => (
  <Icone {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Icone>
);
