import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const profilSelect = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  role: true,
  createdAt: true,
  etablissement: {
    select: { nom: true, departement: true },
  },
  etudiant: {
    select: {
      nom: true,
      prenom: true,
      niveau: true,
      etablissement: { select: { nom: true } },
    },
  },
} as const;

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: profilSelect,
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Erreur GET profil", error);
    return NextResponse.json({ error: "Impossible de récupérer le profil" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json() as { nom?: string; prenom?: string };
    const { nom, prenom } = body ?? {};

    if (nom !== undefined && (typeof nom !== "string" || nom.trim() === "")) {
      return NextResponse.json({ error: "Le nom ne peut pas être vide." }, { status: 400 });
    }
    if (prenom !== undefined && (typeof prenom !== "string" || prenom.trim() === "")) {
      return NextResponse.json({ error: "Le prénom ne peut pas être vide." }, { status: 400 });
    }

    const data: { nom?: string; prenom?: string } = {};
    if (nom) data.nom = nom.trim();
    if (prenom) data.prenom = prenom.trim();

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucune modification fournie." }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: profilSelect,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erreur PATCH profil", error);
    return NextResponse.json({ error: "Impossible de mettre à jour le profil" }, { status: 500 });
  }
}
