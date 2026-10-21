import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Faux Prisma ──────────────────────────────────────────────────────────────

const prismaMock = {
  note: { findMany: vi.fn() },
  absence: { findMany: vi.fn() },
  alerte: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { analyserAlerte, detecterAlerteAbsence, estAggravation, alerteSaisie } = await import("@/lib/detection-alerte");

const ANNEE = "2025-2026";
/** Une note au trimestre 1, deux au trimestre 2 (le minimum pour comparer). */
const notes = (t1: number, t2: number) => [
  { valeur: t1, periode: "Trimestre 1", anneeScolaire: ANNEE },
  { valeur: t2, periode: "Trimestre 2", anneeScolaire: ANNEE },
  { valeur: t2, periode: "Trimestre 2", anneeScolaire: ANNEE },
];
const absences = (n: number) => Array.from({ length: n }, () => ({ periode: "Trimestre 2", anneeScolaire: ANNEE }));
const alerte = (niveauRisque: string, statut = "active") => ({ id: "al-1", niveauRisque, statut, createdAt: new Date("2026-09-01") });
const enregistree = (data: Record<string, unknown>) => ({
  id: "al-1",
  type: "baisse_moyenne",
  statut: "active",
  periode: "Trimestre 2",
  anneeScolaire: ANNEE,
  moyenneAvant: 15,
  moyenneApres: 8,
  ecartPourcent: 46.7,
  createdAt: new Date("2026-09-01T08:00:00.000Z"),
  ...data,
});

// Notes : 15 → 12.6 = −16 % → moyen ; 15 → 8 = −47 % et < 10 → élevé
const MOYEN = notes(15, 12.6);
const ELEVE = notes(15, 8);

beforeEach(() => {
  for (const table of Object.values(prismaMock)) for (const fn of Object.values(table)) fn.mockReset();
  prismaMock.alerte.create.mockImplementation(({ data }) => Promise.resolve(enregistree({ id: "nouvelle", ...data })));
  prismaMock.alerte.update.mockImplementation(({ data }) => Promise.resolve(enregistree(data)));
});

describe("estAggravation", () => {
  it.each([
    ["moyen", "eleve", "active", true],
    ["eleve", "eleve", "active", false],
    ["eleve", "moyen", "active", false],
    ["moyen", "moyen", "active", false],
    ["moyen", "eleve", "traitee", true],
    ["eleve", "eleve", "traitee", false],
    ["inconnu", "eleve", "active", false],
  ])("%s → %s (%s) : %s", (avant, apres, statut, attendu) => {
    expect(estAggravation({ niveauRisque: avant, statut }, apres)).toBe(attendu);
  });
});

describe("analyserAlerte (notes)", () => {
  it("aggravation Moyen → Élevé d'une alerte active : niveau mis à jour et niveauModifieLe rempli", async () => {
    prismaMock.note.findMany.mockResolvedValue(ELEVE);
    prismaMock.alerte.findFirst.mockResolvedValue(alerte("moyen"));
    const avant = Date.now();
    const res = await analyserAlerte("etu-1");
    expect(res).toMatchObject({ issue: "mise_a_jour", niveauPrecedent: "moyen", reactivee: false });
    const data = prismaMock.alerte.update.mock.calls[0][0].data;
    expect(data.niveauRisque).toBe("eleve");
    expect(data.niveauModifieLe).toBeInstanceOf(Date);
    expect(data.niveauModifieLe.getTime()).toBeGreaterThanOrEqual(avant);
  });

  it.each([
    ["niveau inchangé (Élevé → Élevé)", "eleve", ELEVE],
    ["niveau inchangé (Moyen → Moyen)", "moyen", MOYEN],
    ["niveau en baisse (Élevé → Moyen)", "eleve", MOYEN],
  ])("%s : aucune mise à jour, donc aucune notification", async (_, existant, lesNotes) => {
    prismaMock.note.findMany.mockResolvedValue(lesNotes);
    prismaMock.alerte.findFirst.mockResolvedValue(alerte(existant));
    expect(await analyserAlerte("etu-1")).toBeNull();
    expect(prismaMock.alerte.update).not.toHaveBeenCalled();
    expect(prismaMock.alerte.create).not.toHaveBeenCalled();
  });

  it("alerte Moyen traitée qui s'aggrave : réactivée (statut actif) et aggravée", async () => {
    prismaMock.note.findMany.mockResolvedValue(ELEVE);
    prismaMock.alerte.findFirst.mockResolvedValue(alerte("moyen", "traitee"));
    const res = await analyserAlerte("etu-1");
    expect(res).toMatchObject({ issue: "mise_a_jour", niveauPrecedent: "moyen", niveauRisque: "eleve", reactivee: true });
    const data = prismaMock.alerte.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ statut: "active", niveauRisque: "eleve" });
    expect(data.niveauModifieLe).toBeInstanceOf(Date);
  });

  it("alerte Élevé traitée, toujours Élevé : rien (pas de réactivation sans aggravation)", async () => {
    prismaMock.note.findMany.mockResolvedValue(ELEVE);
    prismaMock.alerte.findFirst.mockResolvedValue(alerte("eleve", "traitee"));
    expect(await analyserAlerte("etu-1")).toBeNull();
    expect(prismaMock.alerte.update).not.toHaveBeenCalled();
  });

  it("anti-doublon limité aux alertes de notes : une alerte absences ne bloque pas la baisse de moyenne", async () => {
    prismaMock.note.findMany.mockResolvedValue(MOYEN);
    prismaMock.alerte.findFirst.mockResolvedValue(null);
    expect((await analyserAlerte("etu-1"))?.issue).toBe("creee");
    expect(prismaMock.alerte.findFirst.mock.calls[0][0].where).toMatchObject({ type: "baisse_moyenne", periode: "Trimestre 2" });
  });

  it("création : niveauModifieLe n'est pas rempli (la création notifie déjà)", async () => {
    prismaMock.note.findMany.mockResolvedValue(MOYEN);
    prismaMock.alerte.findFirst.mockResolvedValue(null);
    expect((await analyserAlerte("etu-1"))?.issue).toBe("creee");
    const data = prismaMock.alerte.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("niveauModifieLe");
    expect(data).toMatchObject({ type: "baisse_moyenne", niveauRisque: "moyen", statut: "active" });
  });

  it("une seule note dans la période la plus récente : aucune comparaison, aucune alerte", async () => {
    prismaMock.note.findMany.mockResolvedValue([
      { valeur: 15, periode: "Trimestre 3", anneeScolaire: ANNEE },
      { valeur: 0, periode: "Trimestre 1", anneeScolaire: "2026-2027" },
    ]);
    expect(await analyserAlerte("etu-1")).toBeNull();
    expect(prismaMock.alerte.findFirst).not.toHaveBeenCalled();
  });

  it("nouvel élève (une seule période) : aucune alerte de notes", async () => {
    prismaMock.note.findMany.mockResolvedValue([
      { valeur: 2, periode: "Trimestre 1", anneeScolaire: ANNEE },
      { valeur: 3, periode: "Trimestre 1", anneeScolaire: ANNEE },
    ]);
    expect(await analyserAlerte("etu-1")).toBeNull();
  });

  it("note saisie dans une période ancienne : seules les deux dernières périodes comptent", async () => {
    prismaMock.note.findMany.mockResolvedValue([...notes(12, 12), { valeur: 0, periode: "Trimestre 1", anneeScolaire: "2024-2025" }]);
    expect(await analyserAlerte("etu-1")).toBeNull();
  });

  it("simulation : aggravation décrite, rien n'est écrit", async () => {
    prismaMock.note.findMany.mockResolvedValue(ELEVE);
    prismaMock.alerte.findFirst.mockResolvedValue(alerte("moyen"));
    expect((await analyserAlerte("etu-1", true))?.issue).toBe("mise_a_jour");
    expect(prismaMock.alerte.update).not.toHaveBeenCalled();
  });
});

describe("detecterAlerteAbsence", () => {
  it("aggravation Moyen → Élevé (10 absences injustifiées) : niveauModifieLe rempli", async () => {
    prismaMock.absence.findMany.mockResolvedValue(absences(10));
    prismaMock.alerte.findFirst.mockResolvedValue(alerte("moyen"));
    expect((await detecterAlerteAbsence("etu-1"))?.issue).toBe("mise_a_jour");
    const data = prismaMock.alerte.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ niveauRisque: "eleve", moyenneApres: 10 });
    expect(data.niveauModifieLe).toBeInstanceOf(Date);
  });

  it.each([
    ["niveau inchangé (Élevé, 12 absences)", "eleve", 12],
    ["niveau inchangé (Moyen, 6 absences)", "moyen", 6],
    ["niveau en baisse (Élevé, 6 absences)", "eleve", 6],
  ])("%s : aucune mise à jour", async (_, existant, nb) => {
    prismaMock.absence.findMany.mockResolvedValue(absences(nb));
    prismaMock.alerte.findFirst.mockResolvedValue(alerte(existant));
    expect(await detecterAlerteAbsence("etu-1")).toBeNull();
    expect(prismaMock.alerte.update).not.toHaveBeenCalled();
  });

  it("4 absences injustifiées : sous le seuil, aucune alerte", async () => {
    prismaMock.absence.findMany.mockResolvedValue(absences(4));
    expect(await detecterAlerteAbsence("etu-1")).toBeNull();
    expect(prismaMock.alerte.findFirst).not.toHaveBeenCalled();
  });

  it("création (5 absences) : type absences, niveau Moyen, niveauModifieLe non rempli", async () => {
    prismaMock.absence.findMany.mockResolvedValue(absences(5));
    prismaMock.alerte.findFirst.mockResolvedValue(null);
    expect((await detecterAlerteAbsence("etu-1"))?.issue).toBe("creee");
    expect(prismaMock.alerte.findFirst.mock.calls[0][0].where.type).toBe("absences");
    const data = prismaMock.alerte.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("niveauModifieLe");
    expect(data).toMatchObject({ type: "absences", niveauRisque: "moyen", moyenneApres: 5 });
  });
});

describe("alerteSaisie (réponse de l'API après une saisie)", () => {
  it("aggravation : niveau précédent, réactivation et date ISO", async () => {
    prismaMock.note.findMany.mockResolvedValue(ELEVE);
    prismaMock.alerte.findFirst.mockResolvedValue(alerte("moyen", "traitee"));
    expect(alerteSaisie(await analyserAlerte("etu-1"))).toMatchObject({
      id: "al-1",
      issue: "mise_a_jour",
      niveauRisque: "eleve",
      niveauPrecedent: "moyen",
      reactivee: true,
      statut: "active",
      createdAt: "2026-09-01T08:00:00.000Z",
    });
  });

  it("aucune alerte, ou simulation (rien d'écrit) : null", () => {
    expect(alerteSaisie(null)).toBeNull();
  });
});
