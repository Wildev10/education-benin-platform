import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { requireRole } from "@/lib/auth-guard";
import { nomComplet } from "@/lib/nom-utilisateur";
import { introuvable, peutAccederEtudiant, ROLES_TRAITEMENT_ALERTES } from "@/lib/perimetre";
import { prisma } from "@/lib/prisma";
import { nomResponsableValide } from "@/lib/responsables-server";
import {
  donneesTransition,
  LIBELLES_ACTION,
  LIBELLES_MOTIF,
  responsableApres,
  statutApres,
  statutSuivi,
  validerSaisieSuivi,
} from "@/lib/suivi-alertes";
import { inclureSuivis, selectionResponsable } from "@/lib/suivis-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ACTION_AUDIT = {
  suivre: "ALERTE_SUIVIE",
  resoudre: "ALERTE_RESOLUE",
  rouvrir: "ALERTE_ROUVERTE",
  confier: "ALERTE_CONFIEE",
} as const;

const ERREURS_TRANSITION = {
  resolue: "Cette alerte est résolue : rouvrez-la d'abord.",
  rouvrir: "Seule une alerte résolue peut être rouverte.",
  confier: "Seule une alerte en cours de suivi peut être confiée à quelqu'un d'autre.",
};

/**
 * Étape du suivi d'une alerte : { transition, action, commentaire, motifCloture, responsableId }
 * (voir validerSaisieSuivi). Enseignant et directeur de l'établissement de l'élève ;
 * l'admin consulte seulement. Le responsable choisi doit être un enseignant ou le
 * directeur de cet établissement.
 */
export async function POST(request: Request, context: RouteContext) {
  const access = await requireRole(ROLES_TRAITEMENT_ALERTES);
  if (access instanceof Response) return access;

  try {
    const validation = validerSaisieSuivi(await request.json().catch(() => null));
    if (!validation.ok) return NextResponse.json({ error: validation.erreur }, { status: 400 });
    const { transition, action, commentaire, motifCloture, responsableId: choisi } = validation.saisie;

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
      const erreur = transition === "rouvrir" ? ERREURS_TRANSITION.rouvrir : transition === "confier" && avant !== "resolue" ? ERREURS_TRANSITION.confier : ERREURS_TRANSITION.resolue;
      return NextResponse.json({ error: erreur }, { status: 409 });
    }

    // Responsable : vérifié seulement s'il change ; compte inconnu ou d'un autre
    // établissement, même réponse (rien n'est révélé)
    const auteurId = access.user.id;
    if (!auteurId) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    const responsable = responsableApres(transition, choisi, alerte.responsableId, auteurId);
    const change = responsable !== alerte.responsableId;
    let responsableNom: string | null = null;
    if (change && responsable) {
      responsableNom = await nomResponsableValide(responsable, alerte.etudiant.etablissementId);
      if (!responsableNom) return NextResponse.json({ error: "Responsable invalide." }, { status: 400 });
    }
    if (transition === "confier" && !change) {
      return NextResponse.json({ error: "Cette personne est déjà responsable du suivi." }, { status: 400 });
    }

    const auteur = await prisma.user.findUnique({ where: { id: auteurId }, select: { nom: true, prenom: true } });
    const maintenant = new Date();

    const resultat = await prisma.$transaction(async (tx) => {
      // Garde contre deux saisies simultanées : l'alerte doit être restée dans l'état lu.
      const { count } = await tx.alerte.updateMany({
        where: { id, statut: alerte.statut, suiviDepuis: alerte.suiviDepuis, responsableId: alerte.responsableId },
        data: {
          ...donneesTransition(transition, alerte, maintenant, motifCloture),
          ...(change ? { responsableId: responsable, responsableDepuis: maintenant } : {}),
        },
      });
      if (count === 0) return null;
      await tx.suiviAlerte.create({
        data: {
          alerteId: id,
          auteurId,
          auteurNom: auteur ? nomComplet(auteur.prenom, auteur.nom) : "Utilisateur",
          action,
          commentaire,
          statutAvant: avant,
          statutApres: apres,
          createdAt: maintenant,
          motifCloture,
          ...(change && responsable ? { responsableId: responsable, responsableNom } : {}),
        },
      });
      return tx.alerte.findUnique({ where: { id }, include: { ...inclureSuivis, ...selectionResponsable } });
    });

    if (!resultat) {
      return NextResponse.json(
        { error: "L'alerte vient d'être modifiée par quelqu'un d'autre. Rechargez la page." },
        { status: 409 }
      );
    }

    const eleve = `${alerte.etudiant.prenom} ${alerte.etudiant.nom}`;
    const description =
      transition === "resoudre"
        ? `Alerte résolue pour ${eleve} : ${LIBELLES_MOTIF[motifCloture!]}`
        : transition === "confier"
          ? `Suivi de l'alerte de ${eleve} confié à ${responsableNom}`
          : `${LIBELLES_ACTION[action]} pour ${eleve} : alerte ${transition === "rouvrir" ? "rouverte" : "en cours de suivi"}${change && responsableNom ? `, responsable ${responsableNom}` : ""}`;
    await logAction({ userId: auteurId, action: ACTION_AUDIT[transition], description, entityType: "alerte", entityId: id });

    return NextResponse.json(resultat, { status: 201 });
  } catch (error) {
    console.error("Erreur lors du suivi de l'alerte", error);
    return NextResponse.json({ error: "Impossible d'enregistrer le suivi" }, { status: 500 });
  }
}
