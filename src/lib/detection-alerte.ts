import { prisma } from "@/lib/prisma";

const ordrePeriodes: Record<string, number> = {
  "Trimestre 1": 1,
  "Trimestre 2": 2,
  "Trimestre 3": 3,
};

type MoyennePeriode = {
  anneeScolaire: string;
  periode: string;
  moyenne: number;
  noteCount: number;
};

export type IssueDetection = "creee" | "mise_a_jour" | null;

export type DetailDetection = {
  alerteId?: string; // alerte créée ou modifiée (absent en simulation)
  issue: "creee" | "mise_a_jour";
  periode: string;
  anneeScolaire: string;
  niveauRisque: string;
  moyenneAvant: number;
  moyenneApres: number;
  ecartPourcent: number;
};

export async function detecterAlerte(etudiantId: string): Promise<IssueDetection> {
  return (await analyserAlerte(etudiantId))?.issue ?? null;
}

// En mode simulation, rien n'est écrit : la fonction décrit ce qu'elle ferait.
export async function analyserAlerte(
  etudiantId: string,
  simulation = false
): Promise<DetailDetection | null> {
  const notes = await prisma.note.findMany({
    where: { etudiantId },
    select: {
      valeur: true,
      periode: true,
      anneeScolaire: true,
    },
  });

  const moyennesParPeriode = new Map<
    string,
    MoyennePeriode
  >();

  for (const note of notes) {
    const key = `${note.anneeScolaire}::${note.periode}`;
    const groupe = moyennesParPeriode.get(key);

    if (groupe) {
      groupe.moyenne =
        (groupe.moyenne * groupe.noteCount + note.valeur) /
        (groupe.noteCount + 1);
      groupe.noteCount += 1;
    } else {
      moyennesParPeriode.set(key, {
        anneeScolaire: note.anneeScolaire,
        periode: note.periode,
        moyenne: note.valeur,
        noteCount: 1,
      });
    }
  }

  const periodes = Array.from(moyennesParPeriode.values()).sort((a, b) => {
    const anneeA = Number.parseInt(a.anneeScolaire, 10);
    const anneeB = Number.parseInt(b.anneeScolaire, 10);
    if (anneeA !== anneeB) return anneeA - anneeB;
    return (ordrePeriodes[a.periode] ?? Number.MAX_SAFE_INTEGER) -
      (ordrePeriodes[b.periode] ?? Number.MAX_SAFE_INTEGER);
  });

  if (periodes.length < 2) return null;

  const periodeAvant = periodes[periodes.length - 2];
  const periodeRecente = periodes[periodes.length - 1];
  if (periodeAvant.moyenne <= 0) return null;

  const ecartPourcent =
    ((periodeAvant.moyenne - periodeRecente.moyenne) /
      periodeAvant.moyenne) *
    100;

  let niveauRisque: string;
  if (ecartPourcent >= 20 && periodeRecente.moyenne < 10) {
    niveauRisque = "eleve";
  } else if (ecartPourcent >= 15) {
    niveauRisque = "moyen";
  } else {
    return null;
  }

  // Une seule alerte par étudiant + période + année scolaire, quel que soit son
  // statut. Les anciennes alertes (sans année) comptent pour toute année.
  const alerteExistante = await prisma.alerte.findFirst({
    where: {
      etudiantId,
      periode: periodeRecente.periode,
      OR: [
        { anneeScolaire: periodeRecente.anneeScolaire },
        { anneeScolaire: null },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const detail = {
    periode: periodeRecente.periode,
    anneeScolaire: periodeRecente.anneeScolaire,
    niveauRisque,
    moyenneAvant: periodeAvant.moyenne,
    moyenneApres: periodeRecente.moyenne,
    ecartPourcent,
  };

  if (alerteExistante) {
    // Une alerte active qui s'aggrave (moyen -> élevé) est mise à jour.
    if (
      alerteExistante.statut === "active" &&
      alerteExistante.niveauRisque === "moyen" &&
      niveauRisque === "eleve"
    ) {
      if (!simulation) {
        await prisma.alerte.update({
          where: { id: alerteExistante.id },
          data: {
            niveauRisque,
            moyenneApres: periodeRecente.moyenne,
            ecartPourcent,
          },
        });
      }
      return { issue: "mise_a_jour", alerteId: alerteExistante.id, ...detail };
    }
    return null;
  }

  let alerteId: string | undefined;
  if (!simulation) {
    const creee = await prisma.alerte.create({
      data: {
        etudiantId,
        type: "baisse_moyenne",
        niveauRisque,
        moyenneAvant: periodeAvant.moyenne,
        moyenneApres: periodeRecente.moyenne,
        ecartPourcent,
        periode: periodeRecente.periode,
        anneeScolaire: periodeRecente.anneeScolaire,
        statut: "active",
      },
    });
    alerteId = creee.id;
  }

  return { issue: "creee", alerteId, ...detail };
}
