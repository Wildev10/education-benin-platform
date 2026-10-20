// Filtres de la liste des absences, partagés entre le formulaire (client), la
// page et l'API (absences-server.ts). Aucune dépendance serveur ici.

export const PERIODES = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];
export const MOTIFS = { injustifiee: "Injustifiée", justifiee: "Justifiée" } as const;
export type Motif = keyof typeof MOTIFS;

export type FiltresAbsences = {
  /** Recherche sur le nom ou le prénom de l'élève */
  q?: string;
  periode?: string;
  motif?: Motif;
  /** Année scolaire, AAAA-AAAA */
  annee?: string;
  /** Réservé à l'admin : ignoré pour les autres rôles */
  etablissement?: string;
  /** Un seul élève (API) */
  etudiantId?: string;
};

type ParamsEntree = URLSearchParams | Record<string, string | string[] | undefined>;

function lire(params: ParamsEntree, cle: string): string | undefined {
  const brut = params instanceof URLSearchParams ? params.get(cle) : params[cle];
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  return valeur?.trim() || undefined;
}

/** Lit les filtres depuis l'URL (`anneeScolaire` : ancien nom de l'API). Valeurs inconnues ignorées. */
export function lireFiltresAbsences(params: ParamsEntree): FiltresAbsences {
  const periode = lire(params, "periode");
  const motif = lire(params, "motif");
  const annee = lire(params, "annee") ?? lire(params, "anneeScolaire");
  return {
    q: lire(params, "q")?.slice(0, 100),
    periode: periode && PERIODES.includes(periode) ? periode : undefined,
    motif: motif && motif in MOTIFS ? (motif as Motif) : undefined,
    annee: annee && /^\d{4}-\d{4}$/.test(annee) ? annee : undefined,
    etablissement: lire(params, "etablissement"),
    etudiantId: lire(params, "etudiantId"),
  };
}

/** Sérialise les filtres pour l'URL de la page. */
export function filtresAbsencesVersParams(filtres: FiltresAbsences): URLSearchParams {
  const params = new URLSearchParams();
  if (filtres.q) params.set("q", filtres.q);
  if (filtres.periode) params.set("periode", filtres.periode);
  if (filtres.motif) params.set("motif", filtres.motif);
  if (filtres.annee) params.set("annee", filtres.annee);
  if (filtres.etablissement) params.set("etablissement", filtres.etablissement);
  if (filtres.etudiantId) params.set("etudiantId", filtres.etudiantId);
  return params;
}
