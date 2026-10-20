"use client";

import { useHorsLigne } from "./PwaProvider";
import { LANGUE_PAR_DEFAUT, type Langue } from "@/lib/i18n/langue";
import { TEXTES } from "@/lib/i18n/textes";
import { IconeHorsLigne } from "@/components/ui/Icones";

export function BandeauHorsLigne({ langue = LANGUE_PAR_DEFAUT }: { langue?: Langue }) {
  const horsLigne = useHorsLigne();
  if (!horsLigne) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-[60] border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      <IconeHorsLigne taille={16} className="mr-1.5 inline-block align-[-3px]" />
      {TEXTES[langue].horsLigne.bandeau}
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
