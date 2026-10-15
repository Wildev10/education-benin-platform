import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email || email.length > 254 || !email.includes("@")) {
    return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true },
    });

    // Une seule demande en attente par compte, pour éviter d'inonder la liste de l'admin
    if (user) {
      const enAttente = await prisma.resetRequest.findFirst({
        where: { userId: user.id, traitee: false },
        select: { id: true },
      });
      if (!enAttente) {
        const demande = await prisma.resetRequest.create({
          data: { userId: user.id, email: user.email },
        });
        await logAction({
          userId: user.id,
          action: "MOT_DE_PASSE_CHANGE",
          description: "Demande de réinitialisation de mot de passe",
          entityType: "resetRequest",
          entityId: demande.id,
        });
      }
    }
  } catch (error) {
    console.error("Erreur lors de la demande de réinitialisation", error);
  }

  // Réponse identique que le compte existe ou non
  return NextResponse.json({ success: true });
}
