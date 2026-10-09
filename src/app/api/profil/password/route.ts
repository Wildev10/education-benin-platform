import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      motDePasseActuel?: string;
      nouveauMotDePasse?: string;
      confirmation?: string;
    };
    const { motDePasseActuel, nouveauMotDePasse, confirmation } = body ?? {};

    if (!motDePasseActuel || !nouveauMotDePasse || !confirmation) {
      return NextResponse.json({ error: "Tous les champs sont requis." }, { status: 400 });
    }

    if (typeof nouveauMotDePasse !== "string" || nouveauMotDePasse.length < 8) {
      return NextResponse.json(
        { error: "Le nouveau mot de passe doit contenir au moins 8 caractères." },
        { status: 400 }
      );
    }

    if (nouveauMotDePasse !== confirmation) {
      return NextResponse.json(
        { error: "Le nouveau mot de passe et la confirmation ne correspondent pas." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    const valid = await bcrypt.compare(motDePasseActuel, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Le mot de passe actuel est incorrect." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(nouveauMotDePasse, 10);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur POST profil/password", error);
    return NextResponse.json({ error: "Impossible de mettre à jour le mot de passe" }, { status: 500 });
  }
}
