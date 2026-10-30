import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { logAction } from "@/lib/audit";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { retirerResponsabilites } from "@/lib/responsables-server";

type RouteContext = { params: Promise<{ id: string }> };

const ROLES_VALIDES = ["etudiant", "enseignant", "admin", "directeur"] as const;

/** Enregistrement absent au moment de l'écriture (supprimé entre-temps). */
function estIntrouvable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function utilisateurIntrouvable() {
  return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
}

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
      password?: string;
    };
    const { nom, prenom, email, role, etablissementId, password } = body ?? {};

    if (password !== undefined && (typeof password !== "string" || password.length < 8)) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 8 caractères." },
        { status: 400 }
      );
    }

    const current = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!current) return utilisateurIntrouvable();

    // Prevent admin from changing their own role
    if (access.user.id === id && role !== undefined) {
      if (role !== current.role) {
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
    if (password !== undefined) data.passwordHash = await bcrypt.hash(password, 10);

    // Changement d'établissement ou de rôle : les alertes dont il était responsable
    // et qu'il ne voit plus passent « à désigner » (étape « Système »), dans la même transaction
    const { updated, retirees } = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data, select: utilisateurSelect });
      const retirees = await retirerResponsabilites(
        tx,
        { id, nom: updated.nom, prenom: updated.prenom },
        { role: updated.role, etablissementId: updated.etablissementId }
      );
      return { updated, retirees };
    });

    await logAction({
      userId: access.user.id,
      action: "UTILISATEUR_MODIFIE",
      description: `Compte modifié : ${updated.prenom} ${updated.nom}${password !== undefined ? " (mot de passe réinitialisé)" : ""}${retirees ? ` ; responsable retiré de ${retirees} alerte${retirees > 1 ? "s" : ""}` : ""}`,
      entityType: "utilisateur",
      entityId: updated.id,
    });

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    if (estIntrouvable(error)) return utilisateurIntrouvable();
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
    if (!utilisateur) return utilisateurIntrouvable();

    await prisma.user.delete({ where: { id } });

    await logAction({
      userId: access.user.id,
      action: "UTILISATEUR_SUPPRIME",
      description: `Compte supprimé : ${utilisateur.prenom} ${utilisateur.nom} (${utilisateur.role})`,
      entityType: "utilisateur",
      entityId: id,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (estIntrouvable(error)) return utilisateurIntrouvable();
    console.error("Erreur DELETE utilisateur", error);
    return NextResponse.json({ error: "Impossible de supprimer l'utilisateur." }, { status: 500 });
  }
}
