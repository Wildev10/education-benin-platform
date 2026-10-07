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

// ── Détection alerte absences ────────────────────────────────────────────────

const SEUIL_MOYEN = 5;
const SEUIL_ELEVE = 10;

export async function detecterAlerteAbsence(etudiantId: string): Promise<boolean> {
  // Compte les absences injustifiées par (anneeScolaire, periode)
  const absences = await prisma.absence.findMany({
    where: { etudiantId, motif: "injustifiee" },
    select: { periode: true, anneeScolaire: true },
  });

  if (absences.length === 0) return false;

  // Groupe par (anneeScolaire::periode)
  const compteurs = new Map<string, { periode: string; anneeScolaire: string; count: number }>();
  for (const a of absences) {
    const key = `${a.anneeScolaire}::${a.periode}`;
    const entry = compteurs.get(key);
    if (entry) entry.count++;
    else compteurs.set(key, { periode: a.periode, anneeScolaire: a.anneeScolaire, count: 1 });
  }

  // Prend la période la plus récente avec le plus d'absences
  const periodes = Array.from(compteurs.values()).sort((a, b) => {
    const anneeA = Number.parseInt(a.anneeScolaire, 10);
    const anneeB = Number.parseInt(b.anneeScolaire, 10);
    if (anneeA !== anneeB) return anneeB - anneeA;
    return (ordrePeriodes[b.periode] ?? 0) - (ordrePeriodes[a.periode] ?? 0);
  });

  const cible = periodes[0];
  const { periode, anneeScolaire, count } = cible;

  let niveauRisque: string;
  if (count >= SEUIL_ELEVE) {
    niveauRisque = "eleve";
  } else if (count >= SEUIL_MOYEN) {
    niveauRisque = "moyen";
  } else {
    return false;
  }

  // Anti-doublon : cherche une alerte absences existante pour cet étudiant/période
  const alerteExistante = await prisma.alerte.findFirst({
    where: {
      etudiantId,
      type: "absences",
      periode,
      OR: [{ anneeScolaire }, { anneeScolaire: null }],
    },
    orderBy: { createdAt: "desc" },
  });

  if (alerteExistante) {
    if (
      alerteExistante.statut === "active" &&
      alerteExistante.niveauRisque === "moyen" &&
      niveauRisque === "eleve"
    ) {
      await prisma.alerte.update({
        where: { id: alerteExistante.id },
        data: { niveauRisque, moyenneApres: count, ecartPourcent: 0 },
      });
      return true;
    }
    return false;
  }

  await prisma.alerte.create({
    data: {
      etudiantId,
      type: "absences",
      niveauRisque,
      moyenneAvant: 0,
      moyenneApres: count,
      ecartPourcent: 0,
      periode,
      anneeScolaire,
      statut: "active",
    },
  });
  return true;
}
