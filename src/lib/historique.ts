import { ACTION_TYPES, type ActionType } from "@/lib/audit-types";
import { prisma } from "@/lib/prisma";

export async function getHistorique(filtres: { action?: string | null; userId?: string | null }) {
  const action = ACTION_TYPES.includes(filtres.action as ActionType) ? filtres.action! : undefined;

  const logs = await prisma.actionLog.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(filtres.userId ? { userId: filtres.userId } : {}),
    },
    include: { user: { select: { id: true, nom: true, prenom: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return logs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() }));
}

export type EntreeHistorique = Awaited<ReturnType<typeof getHistorique>>[number];
