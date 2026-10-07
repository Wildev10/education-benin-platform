import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const ROLES_VALIDES = ["etudiant", "enseignant", "admin"] as const;

export async function GET() {
  const access = await requireRole(["admin"]);
  if (access instanceof Response) return access;

  try {
    const utilisateurs = await prisma.user.findMany({
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        etudiantId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(utilisateurs);
  } catch (error) {
    console.error("Erreur GET utilisateurs", error);
    return NextResponse.json({ error: "Impossible de récupérer les utilisateurs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await requireRole(["admin"]);
  if (access instanceof Response) return access;

  try {
    const body = await request.json();
    const { nom, prenom, email, role, motDePasse, etudiantId } = body ?? {};

    if (!nom || !prenom || !email || !role || !motDePasse) {
      return NextResponse.json({ error: "Tous les champs obligatoires doivent être remplis." }, { status: 400 });
    }
    if (!ROLES_VALIDES.includes(role)) {
      return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
    }
    if (typeof motDePasse !== "string" || motDePasse.length < 8) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
    }

    const emailExistant = await prisma.user.findUnique({ where: { email } });
    if (emailExistant) {
      return NextResponse.json({ error: "Un compte avec cet email existe déjà." }, { status: 409 });
    }

    if (role === "etudiant" && etudiantId) {
      const etudiant = await prisma.etudiant.findUnique({ where: { id: etudiantId } });
      if (!etudiant) {
        return NextResponse.json({ error: "Étudiant introuvable." }, { status: 400 });
      }
      const compteExistant = await prisma.user.findFirst({ where: { etudiantId } });
      if (compteExistant) {
        return NextResponse.json({ error: "Cet étudiant a déjà un compte." }, { status: 409 });
      }
    }

    const passwordHash = await bcrypt.hash(motDePasse, 10);
    const utilisateur = await prisma.user.create({
      data: {
        nom,
        prenom,
        email,
        role,
        passwordHash,
        ...(role === "etudiant" && etudiantId ? { etudiantId } : {}),
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        etudiantId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(utilisateur, { status: 201 });
  } catch (error) {
    console.error("Erreur POST utilisateur", error);
    return NextResponse.json({ error: "Impossible de créer le compte." }, { status: 500 });
  }
}
