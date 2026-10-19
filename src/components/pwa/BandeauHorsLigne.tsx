"use client";

import { useHorsLigne } from "./PwaProvider";

export function BandeauHorsLigne() {
  const horsLigne = useHorsLigne();
  if (!horsLigne) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-[60] border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      <span aria-hidden="true">⚡ </span>
      Vous êtes hors ligne — données affichées de votre dernière visite
    </div>
  );
}

/** Explication affichée à côté des actions d'écriture désactivées hors ligne. */
export function MessageEcritureHorsLigne({ className = "" }: { className?: string }) {
  const horsLigne = useHorsLigne();
  if (!horsLigne) return null;
  return (
    <p className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 ${className}`}>
      Enregistrement indisponible hors ligne. Il sera de nouveau possible dès le retour de la connexion.
    </p>
  );
}

export const TITRE_HORS_LIGNE = "Indisponible hors ligne";
