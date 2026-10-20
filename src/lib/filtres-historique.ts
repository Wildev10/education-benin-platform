import { ACTION_TYPES, type ActionType } from "@/lib/audit-types";

// Filtres du journal d'audit, partagés entre la page (client) et historique.ts.

export type FiltresHistorique = { action?: string | null; userId?: string | null };

/** Filtres lus dans l'URL de la page (action, utilisateur) et leur forme canonique. */
export function lireFiltresHistorique(params: Record<string, string | string[] | undefined>) {
  const valeur = (cle: string) => {
    const brut = params[cle];
    return (Array.isArray(brut) ? brut[0] : brut)?.trim() || undefined;
  };
  const action = valeur("action");
  return {
    action: action && ACTION_TYPES.includes(action as ActionType) ? action : undefined,
    userId: valeur("utilisateur") ?? valeur("userId"),
  };
}

export function filtresHistoriqueVersParams(filtres: FiltresHistorique): URLSearchParams {
  const params = new URLSearchParams();
  if (filtres.action) params.set("action", filtres.action);
  if (filtres.userId) params.set("utilisateur", filtres.userId);
  return params;
}
