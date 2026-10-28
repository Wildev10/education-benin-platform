import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { requireRole } from "@/lib/auth-guard";
import { nomComplet } from "@/lib/nom-utilisateur";
import { introuvable, peutAccederEtudiant, ROLES_TRAITEMENT_ALERTES } from "@/lib/perimetre";
import { prisma } from "@/lib/prisma";
import {
  donneesTransition,
  LIBELLES_ACTION,
  statutApres,
  statutSuivi,
  validerSaisieSuivi,
} from "@/lib/suivi-alertes";
import { inclureSuivis } from "@/lib/suivis-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ACTION_AUDIT = { suivre: "ALERTE_SUIVIE", resoudre: "ALERTE_RESOLUE", rouvrir: "ALERTE_ROUVERTE" } as const;

/**
 * Étape du suivi d'une alerte : { transition, action, commentaire }.
 * Enseignant et directeur de l'établissement de l'élève ; l'admin consulte seulement.
 */
export async function POST(request: Request, context: RouteContext) {
  const access = await requireRole(ROLES_TRAITEMENT_ALERTES);
  if (access instanceof Response) return access;

  try {
    const validation = validerSaisieSuivi(await request.json().catch(() => null));
    if (!validation.ok) return NextResponse.json({ error: validation.erreur }, { status: 400 });
    const { transition, action, commentaire } = validation.saisie;

    const { id } = await context.params;
    const alerte = await prisma.alerte.findUnique({
      where: { id },
      include: { etudiant: { select: { id: true, nom: true, prenom: true, etablissementId: true } } },
    });
    // Hors périmètre = introuvable : on ne révèle pas l'existence de l'alerte
    if (!alerte || !peutAccederEtudiant(access.user, alerte.etudiant)) {
      return introuvable("Alerte introuvable");
    }

    const avant = statutSuivi(alerte);
    const apres = statutApres(avant, transition);
    if (!apres) {
      return NextResponse.json(
        { error: avant === "resolue" ? "Cette alerte est résolue : rouvrez-la d'abord." : "Seule une alerte résolue peut être rouverte." },
        { status: 409 }
      );
    }

    const auteur = await prisma.user.findUnique({ where: { id: access.user.id }, select: { nom: true, prenom: true } });
    const maintenant = new Date();

    const resultat = await prisma.$transaction(async (tx) => {
      // Garde contre deux saisies simultanées : l'alerte doit être restée dans l'état lu.
      const { count } = await tx.alerte.updateMany({
        where: { id, statut: alerte.statut, suiviDepuis: alerte.suiviDepuis },
        data: donneesTransition(transition, alerte, maintenant),
      });
      if (count === 0) return null;
      await tx.suiviAlerte.create({
        data: {
          alerteId: id,
          auteurId: access.user.id,
          auteurNom: auteur ? nomComplet(auteur.prenom, auteur.nom) : "Utilisateur",
          action,
          commentaire,
          statutAvant: avant,
          statutApres: apres,
          createdAt: maintenant,
        },
      });
      return tx.alerte.findUnique({ where: { id }, include: inclureSuivis });
    });

    if (!resultat) {
      return NextResponse.json(
        { error: "L'alerte vient d'être modifiée par quelqu'un d'autre. Rechargez la page." },
        { status: 409 }
      );
    }

    await logAction({
      userId: access.user.id,
      action: ACTION_AUDIT[transition],
      description: `${LIBELLES_ACTION[action]} pour ${alerte.etudiant.prenom} ${alerte.etudiant.nom} : alerte ${apres === "resolue" ? "résolue" : apres === "en_suivi" && avant === "resolue" ? "rouverte" : "en cours de suivi"}`,
      entityType: "alerte",
      entityId: id,
    });

    return NextResponse.json(resultat, { status: 201 });
  } catch (error) {
    console.error("Erreur lors du suivi de l'alerte", error);
    return NextResponse.json({ error: "Impossible d'enregistrer le suivi" }, { status: 500 });
  }
}
