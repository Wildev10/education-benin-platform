import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/audit";
import { requireRole } from "@/lib/auth-guard";
import { lirePagination, paginationDemandee } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { listerUtilisateursPagines, selectionUtilisateur } from "@/lib/utilisateurs-server";

const ROLES_VALIDES = ["etudiant", "enseignant", "admin", "directeur"] as const;

/** Avec `page` ou `taille` : une page { elements, total, page, taille, nbPages } ; sans : tous les comptes. */
export async function GET(request: Request) {
  const access = await requireRole(["admin"]);
  if (access instanceof Response) return access;

  try {
    const params = new URL(request.url).searchParams;
    if (paginationDemandee(params)) {
      return NextResponse.json(await listerUtilisateursPagines(lirePagination(params)));
    }
    const utilisateurs = await prisma.user.findMany({
      select: selectionUtilisateur,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
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
    const { nom, prenom, email, role, motDePasse, etudiantId, etablissementId } = body ?? {};

    if (!nom || !prenom || !email || !role || !motDePasse) {
      return NextResponse.json({ error: "Tous les champs obligatoires doivent être remplis." }, { status: 400 });
    }
    if (!ROLES_VALIDES.includes(role)) {
      return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
    }
    if ((role === "directeur" || role === "enseignant") && !etablissementId) {
      return NextResponse.json({ error: "L'établissement est obligatoire pour un directeur ou un enseignant." }, { status: 400 });
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

    if ((role === "directeur" || role === "enseignant") && etablissementId) {
      const etab = await prisma.etablissement.findUnique({ where: { id: etablissementId } });
      if (!etab) {
        return NextResponse.json({ error: "Établissement introuvable." }, { status: 400 });
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
        ...((role === "directeur" || role === "enseignant") && etablissementId ? { etablissementId } : {}),
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        etudiantId: true,
        etablissementId: true,
        createdAt: true,
      },
    });

    await logAction({
      userId: access.user.id,
      action: "UTILISATEUR_CREE",
      description: `Compte créé : ${utilisateur.prenom} ${utilisateur.nom} (${utilisateur.role})`,
      entityType: "utilisateur",
      entityId: utilisateur.id,
    });

    return NextResponse.json(utilisateur, { status: 201 });
  } catch (error) {
    console.error("Erreur POST utilisateur", error);
    return NextResponse.json({ error: "Impossible de créer le compte." }, { status: 500 });
  }
}
