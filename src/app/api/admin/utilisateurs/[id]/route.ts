import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const ROLES_VALIDES = ["etudiant", "enseignant", "admin", "directeur"] as const;

const utilisateurSelect = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  role: true,
  etudiantId: true,
  etablissementId: true,
  etablissement: { select: { nom: true } },
  createdAt: true,
} as const;

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireRole(["admin"]);
  if (access instanceof Response) return access;

  const { id } = await context.params;

  try {
    const body = await request.json() as {
      nom?: string;
      prenom?: string;
      email?: string;
      role?: string;
      etablissementId?: string | null;
    };
    const { nom, prenom, email, role, etablissementId } = body ?? {};

    // Prevent admin from changing their own role
    if (access.user.id === id && role !== undefined) {
      const current = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (current && role !== current.role) {
        return NextResponse.json(
          { error: "Vous ne pouvez pas modifier votre propre rôle." },
          { status: 403 }
        );
      }
    }

    // Validate role
    if (role !== undefined && !(ROLES_VALIDES as readonly string[]).includes(role)) {
      return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
    }

    // Require etablissementId for enseignant / directeur
    if ((role === "enseignant" || role === "directeur") && !etablissementId) {
      return NextResponse.json(
        { error: "L'établissement est obligatoire pour un enseignant ou un directeur." },
        { status: 400 }
      );
    }

    // Email uniqueness
    if (email !== undefined) {
      const duplicate = await prisma.user.findFirst({
        where: { email: email.trim(), NOT: { id } },
      });
      if (duplicate) {
        return NextResponse.json({ error: "Email déjà utilisé." }, { status: 409 });
      }
    }

    const data: Record<string, unknown> = {};
    if (nom?.trim()) data.nom = nom.trim();
    if (prenom?.trim()) data.prenom = prenom.trim();
    if (email?.trim()) data.email = email.trim();
    if (role) data.role = role;
    if (etablissementId !== undefined) data.etablissementId = etablissementId || null;

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: utilisateurSelect,
    });

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Erreur PATCH utilisateur", error);
    return NextResponse.json({ error: "Impossible de modifier l'utilisateur." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireRole(["admin"]);
  if (access instanceof Response) return access;

  const { id } = await context.params;

  if (access.user.id === id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas supprimer votre propre compte." },
      { status: 403 }
    );
  }

  try {
    const utilisateur = await prisma.user.findUnique({ where: { id } });
    if (!utilisateur) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    await prisma.user.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Erreur DELETE utilisateur", error);
    return NextResponse.json({ error: "Impossible de supprimer l'utilisateur." }, { status: 500 });
  }
}
