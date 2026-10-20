import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Faux Prisma ──────────────────────────────────────────────────────────────

const prismaMock = {
  note: { findMany: vi.fn() },
  absence: { findMany: vi.fn() },
  alerte: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { analyserAlerte, detecterAlerteAbsence, estAggravation } = await import("@/lib/detection-alerte");

const ANNEE = "2025-2026";
const notes = (t1: number, t2: number) => [
  { valeur: t1, periode: "Trimestre 1", anneeScolaire: ANNEE },
  { valeur: t2, periode: "Trimestre 2", anneeScolaire: ANNEE },
];
const absences = (n: number) => Array.from({ length: n }, () => ({ periode: "Trimestre 2", anneeScolaire: ANNEE }));
const alerte = (niveauRisque: string, statut = "active") => ({ id: "al-1", niveauRisque, statut, createdAt: new Date("2026-09-01") });

// Notes : 15 → 12.6 = −16 % → moyen ; 15 → 8 = −47 % et < 10 → élevé
const MOYEN = notes(15, 12.6);
const ELEVE = notes(15, 8);

beforeEach(() => {
  for (const table of Object.values(prismaMock)) for (const fn of Object.values(table)) fn.mockReset();
  prismaMock.alerte.create.mockResolvedValue({ id: "nouvelle" });
});

describe("estAggravation", () => {
  it.each([
    ["moyen", "eleve", "active", true],
    ["eleve", "eleve", "active", false],
    ["eleve", "moyen", "active", false],
    ["moyen", "moyen", "active", false],
    ["moyen", "eleve", "traitee", false],
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
    expect(res?.issue).toBe("mise_a_jour");
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

  it("alerte déjà traitée qui s'aggraverait : rien", async () => {
    prismaMock.note.findMany.mockResolvedValue(ELEVE);
    prismaMock.alerte.findFirst.mockResolvedValue(alerte("moyen", "traitee"));
    expect(await analyserAlerte("etu-1")).toBeNull();
    expect(prismaMock.alerte.update).not.toHaveBeenCalled();
  });

  it("création : niveauModifieLe n'est pas rempli (la création notifie déjà)", async () => {
    prismaMock.note.findMany.mockResolvedValue(MOYEN);
    prismaMock.alerte.findFirst.mockResolvedValue(null);
    expect((await analyserAlerte("etu-1"))?.issue).toBe("creee");
    expect(prismaMock.alerte.create.mock.calls[0][0].data).not.toHaveProperty("niveauModifieLe");
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
    expect(await detecterAlerteAbsence("etu-1")).toBe(true);
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
    expect(await detecterAlerteAbsence("etu-1")).toBe(false);
    expect(prismaMock.alerte.update).not.toHaveBeenCalled();
  });

  it("création : niveauModifieLe n'est pas rempli", async () => {
    prismaMock.absence.findMany.mockResolvedValue(absences(5));
    prismaMock.alerte.findFirst.mockResolvedValue(null);
    expect(await detecterAlerteAbsence("etu-1")).toBe(true);
    expect(prismaMock.alerte.create.mock.calls[0][0].data).not.toHaveProperty("niveauModifieLe");
  });
});
