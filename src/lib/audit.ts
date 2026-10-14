import { prisma } from "@/lib/prisma";
import type { ActionType } from "@/lib/audit-types";

export type { ActionType };

export async function logAction({
  userId,
  ...params
}: {
  userId: string | undefined;
  action: ActionType;
  description: string;
  entityType?: string;
  entityId?: string;
}) {
  if (!userId) return;
  try {
    await prisma.actionLog.create({ data: { userId, ...params } });
  } catch (error) {
    // Ne jamais faire planter une action à cause de l'audit
    console.error("Échec de l'écriture du journal d'audit", error);
  }
}
