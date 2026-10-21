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
  /** Suite du compteur, accordée : « 13 alertes détectées sur les 7 derniers jours » */
  libelle: string;
  /** Précision sous la phrase */
  precision: string;
  href: string;
  total: number;
};

type Accord = { un: string; plusieurs: string };

/** Libellé lu après le nombre : singulier pour 0 et 1, comme en français. */
export function accorder(total: number, { un, plusieurs }: Accord): string {
  return total <= 1 ? un : plusieurs;
}

/** Jour (AAAA-MM-JJ, heure du Bénin) du début de la période des 7 derniers jours, aujourd'hui compris. */
export function debutSeptDerniersJours(maintenant: Date = new Date()): string {
  const ilYASixJours = new Date(maintenant.getTime() - 6 * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(ilYASixJours);
}

function formaterJour(jour: string) {
  return new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: FUSEAU_BENIN });
}

export function definitionsRaccourcis(
  maintenant: Date = new Date()
): (Omit<Raccourci, "total" | "libelle"> & { libelle: Accord })[] {
  const du = debutSeptDerniersJours(maintenant);
  const parametres: { cle: CleRaccourci; libelle: Accord; precision: string; params: Record<string, string> }[] = [
    {
      cle: "eleve",
      libelle: { un: "alerte à risque élevé", plusieurs: "alertes à risque élevé" },
      precision: "à examiner en priorité",
      params: { niveau: "eleve" },
    },
    {
      cle: "absences",
      libelle: { un: "alerte pour absences répétées", plusieurs: "alertes pour absences répétées" },
      precision: "5 absences injustifiées ou plus sur un trimestre",
      params: { type: "absences" },
    },
    {
      cle: "recentes",
      libelle: { un: "alerte détectée sur les 7 derniers jours", plusieurs: "alertes détectées sur les 7 derniers jours" },
      precision: `depuis le ${formaterJour(du)}`,
      params: { du },
    },
  ];
  return parametres.map(({ params, ...r }) => ({ ...r, href: `/admin/alertes?${new URLSearchParams(params)}` }));
}

/** Les accès directs avec leur nombre d'alertes actives, pour une portée (l'admin : toutes). */
export async function raccourcisAlertes(portee: PorteeAlertes, maintenant: Date = new Date()): Promise<Raccourci[]> {
  return Promise.all(
    definitionsRaccourcis(maintenant).map(async (r) => {
      const filtres = lireFiltres(Object.fromEntries(new URL(r.href, "http://x").searchParams));
      const where = construireWhereAlertes(filtres, portee);
      const total = where ? await prisma.alerte.count({ where }) : 0;
      return { ...r, libelle: accorder(total, r.libelle), total };
    })
  );
}
