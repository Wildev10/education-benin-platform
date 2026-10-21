import { describe, expect, it, vi } from "vitest";

const prismaMock = {
  etablissement: { findMany: vi.fn() },
  alerte: { findMany: vi.fn() },
  note: { groupBy: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { getStatsEtablissements } = await import("@/lib/stats-etablissements");

describe("getStatsEtablissements : moyenne générale", () => {
  it("sur l'année la plus récente de l'établissement, sans mélanger deux années", async () => {
    prismaMock.etablissement.findMany.mockResolvedValue([
      { id: "e1", nom: "CEG 1", departement: "Littoral", etudiants: [{ id: "a" }, { id: "b" }] },
      { id: "e2", nom: "CEG 2", departement: "Borgou", etudiants: [{ id: "c" }] },
    ]);
    prismaMock.alerte.findMany.mockResolvedValue([]);
    prismaMock.note.groupBy.mockResolvedValue([
      { etudiantId: "a", anneeScolaire: "2025-2026", _avg: { valeur: 16 } },
      { etudiantId: "a", anneeScolaire: "2026-2027", _avg: { valeur: 10 } },
      { etudiantId: "b", anneeScolaire: "2025-2026", _avg: { valeur: 14 } }, // pas encore de note en 2026-2027
      { etudiantId: "c", anneeScolaire: "2025-2026", _avg: { valeur: 12 } },
    ]);
    const stats = await getStatsEtablissements();
    expect(prismaMock.note.groupBy.mock.calls[0][0].by).toEqual(["etudiantId", "anneeScolaire"]);
    expect(stats.find((s) => s.id === "e1")).toMatchObject({ anneeMoyenne: "2026-2027", moyenneGenerale: 10 });
    expect(stats.find((s) => s.id === "e2")).toMatchObject({ anneeMoyenne: "2025-2026", moyenneGenerale: 12 });
  });

  it("sans note : pas de moyenne ni d'année", async () => {
    prismaMock.etablissement.findMany.mockResolvedValue([{ id: "e1", nom: "CEG 1", departement: "Littoral", etudiants: [{ id: "a" }] }]);
    prismaMock.alerte.findMany.mockResolvedValue([]);
    prismaMock.note.groupBy.mockResolvedValue([]);
    expect((await getStatsEtablissements())[0]).toMatchObject({ anneeMoyenne: null, moyenneGenerale: null });
  });
});
