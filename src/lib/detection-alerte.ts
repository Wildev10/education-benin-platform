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

export async function detecterAlerte(etudiantId: string): Promise<boolean> {
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

  if (periodes.length < 2) return false;

  const periodeAvant = periodes[periodes.length - 2];
  const periodeRecente = periodes[periodes.length - 1];
  if (periodeAvant.moyenne <= 0) return false;

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
    return false;
  }

  const alerteExistante = await prisma.alerte.findFirst({
    where: {
      etudiantId,
      periode: periodeRecente.periode,
      statut: "active",
    },
  });

  if (alerteExistante) return false;

  await prisma.alerte.create({
    data: {
      etudiantId,
      type: "baisse_moyenne",
      niveauRisque,
      moyenneAvant: periodeAvant.moyenne,
      moyenneApres: periodeRecente.moyenne,
      ecartPourcent,
      periode: periodeRecente.periode,
      statut: "active",
    },
  });

  return true;
}
