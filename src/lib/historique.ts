import type { Prisma } from "@/generated/prisma/client";
import { ACTION_TYPES, type ActionType } from "@/lib/audit-types";
import type { FiltresHistorique } from "@/lib/filtres-historique";
import { paginer, type DemandePage, type PageResultats } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

function construireWhere(filtres: FiltresHistorique): Prisma.ActionLogWhereInput {
  const action = ACTION_TYPES.includes(filtres.action as ActionType) ? filtres.action! : undefined;
  return {
    ...(action ? { action } : {}),
    ...(filtres.userId ? { userId: filtres.userId } : {}),
  };
}

const lecture = {
  include: { user: { select: { id: true, nom: true, prenom: true, role: true } } },
  orderBy: [{ createdAt: "desc" }, { id: "asc" }],
} satisfies Omit<Prisma.ActionLogFindManyArgs, "where">;

function serialiser<T extends { createdAt: Date }>(log: T) {
  return { ...log, createdAt: log.createdAt.toISOString() };
}

/** Les 100 dernières actions (API sans pagination, comportement d'origine). */
export async function getHistorique(filtres: FiltresHistorique) {
  const logs = await prisma.actionLog.findMany({ where: construireWhere(filtres), ...lecture, take: 100 });
  return logs.map(serialiser);
}

export type EntreeHistorique = Awaited<ReturnType<typeof getHistorique>>[number];

/** Une page du journal, des actions les plus récentes aux plus anciennes. */
export async function getHistoriquePagine(
  filtres: FiltresHistorique,
  demande: DemandePage
): Promise<PageResultats<EntreeHistorique>> {
  const where = construireWhere(filtres);
  const resultat = await paginer(
    demande,
    () => prisma.actionLog.count({ where }),
    (fenetre) => prisma.actionLog.findMany({ where, ...lecture, ...fenetre })
  );
  return { ...resultat, elements: resultat.elements.map(serialiser) };
}
