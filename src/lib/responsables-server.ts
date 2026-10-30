import { nomComplet } from "@/lib/nom-utilisateur";
import { prisma } from "@/lib/prisma";
import { AUTEUR_SYSTEME, statutSuivi } from "@/lib/suivi-alertes";

/**
 * Responsable du suivi d'une alerte : un enseignant ou le directeur de
 * l'établissement de l'élève. La liste et la vérification se font côté serveur.
 */
export const ROLES_RESPONSABLE = ["enseignant", "directeur"];

export type CandidatResponsable = { id: string; nom: string; role: string };

/** Enseignants et directeur de l'établissement, le directeur en tête puis par nom. */
export async function candidatsResponsables(etablissementId: string): Promise<CandidatResponsable[]> {
  const comptes = await prisma.user.findMany({
    where: { etablissementId, role: { in: ROLES_RESPONSABLE } },
    select: { id: true, nom: true, prenom: true, role: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });
  return comptes
    .map((c) => ({ id: c.id, nom: nomComplet(c.prenom, c.nom), role: c.role }))
    .sort((a, b) => Number(b.role === "directeur") - Number(a.role === "directeur"));
}

/**
 * Le compte peut-il être responsable d'une alerte d'un élève de cet
 * établissement ? Renvoie son nom affiché, ou null (compte inexistant ou d'un
 * autre établissement : même réponse, rien n'est révélé).
 */
export async function nomResponsableValide(userId: string, etablissementId: string): Promise<string | null> {
  const compte = await prisma.user.findFirst({
    where: { id: userId, etablissementId, role: { in: ROLES_RESPONSABLE } },
    select: { nom: true, prenom: true },
  });
  return compte ? nomComplet(compte.prenom, compte.nom) : null;
}

/**
 * Changement d'établissement ou de rôle d'un compte : il n'est plus
 * responsable des alertes qu'il ne peut plus voir. Chaque alerte concernée
 * passe « à désigner », avec une étape « Système ». Renvoie le nombre d'alertes.
 */
export async function retirerResponsabilites(
  // Le client de transaction du client étendu de src/lib/prisma.ts (ou ce client lui-même)
  tx: Pick<typeof prisma, "alerte">,
  compte: { id: string; nom: string; prenom: string },
  apres: { role: string; etablissementId: string | null },
  maintenant: Date = new Date()
): Promise<number> {
  const garde = ROLES_RESPONSABLE.includes(apres.role) && apres.etablissementId;
  const alertes = await tx.alerte.findMany({
    where: {
      responsableId: compte.id,
      ...(garde ? { etudiant: { etablissementId: { not: apres.etablissementId! } } } : {}),
    },
    select: { id: true, statut: true, suiviDepuis: true },
  });
  const nom = nomComplet(compte.prenom, compte.nom);
  for (const alerte of alertes) {
    const statut = statutSuivi(alerte);
    await tx.alerte.update({
      where: { id: alerte.id },
      data: {
        responsableId: null,
        responsableDepuis: null,
        suivis: {
          create: {
            auteurNom: AUTEUR_SYSTEME,
            action: "retrait_responsable",
            commentaire: `${nom} n'est plus dans l'établissement de l'élève : responsable à désigner.`,
            statutAvant: statut,
            statutApres: statut,
            createdAt: maintenant,
          },
        },
      },
    });
  }
  return alertes.length;
}
