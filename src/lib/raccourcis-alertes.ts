import { prisma } from "@/lib/prisma";
import { construireWhereAlertes, lireFiltres, type PorteeAlertes } from "@/lib/filtres-alertes";
import { FUSEAU_BENIN } from "@/lib/dates";

/**
 * Accès directs du tableau de bord national vers la page Alertes déjà
 * filtrée. Le compteur de chaque accès est calculé avec les fonctions mêmes de
 * la page Alertes (lecture de l'URL, puis requête) : il annonce exactement le
 * nombre d'alertes que la page affichera.
 */

export type CleRaccourci = "eleve" | "absences" | "recentes";

export type Raccourci = {
  cle: CleRaccourci;
  libelle: string;
  /** Complément lu après le compteur (« 3 alertes actives… ») */
  precision: string;
  href: string;
  total: number;
};

/** Jour (AAAA-MM-JJ, heure du Bénin) du début de la période des 7 derniers jours, aujourd'hui compris. */
export function debutSeptDerniersJours(maintenant: Date = new Date()): string {
  const ilYASixJours = new Date(maintenant.getTime() - 6 * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(ilYASixJours);
}

function formaterJour(jour: string) {
  return new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: FUSEAU_BENIN });
}

export function definitionsRaccourcis(maintenant: Date = new Date()): Omit<Raccourci, "total">[] {
  const du = debutSeptDerniersJours(maintenant);
  const parametres: { cle: CleRaccourci; libelle: string; precision: string; params: Record<string, string> }[] = [
    { cle: "eleve", libelle: "Risque élevé", precision: "à examiner en priorité", params: { niveau: "eleve" } },
    { cle: "absences", libelle: "Absences répétées", precision: "liées à l'assiduité", params: { type: "absences" } },
    { cle: "recentes", libelle: "7 derniers jours", precision: `détectées depuis le ${formaterJour(du)}`, params: { du } },
  ];
  return parametres.map(({ params, ...r }) => ({ ...r, href: `/admin/alertes?${new URLSearchParams(params)}` }));
}

/** Les accès directs avec leur nombre d'alertes actives, pour une portée (l'admin : toutes). */
export async function raccourcisAlertes(portee: PorteeAlertes, maintenant: Date = new Date()): Promise<Raccourci[]> {
  return Promise.all(
    definitionsRaccourcis(maintenant).map(async (r) => {
      const filtres = lireFiltres(Object.fromEntries(new URL(r.href, "http://x").searchParams));
      const where = construireWhereAlertes(filtres, portee);
      return { ...r, total: where ? await prisma.alerte.count({ where }) : 0 };
    })
  );
}
