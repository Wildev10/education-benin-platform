import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCount = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { alerte: { count: mockCount } } }));

const { debutSeptDerniersJours, definitionsRaccourcis, raccourcisAlertes } = await import("@/lib/raccourcis-alertes");

const MAINTENANT = new Date("2026-10-20T10:00:00Z");

describe("accès directs aux alertes", () => {
  beforeEach(() => mockCount.mockReset().mockResolvedValue(0));

  it("trois accès vers la page Alertes filtrée : risque élevé, absences, 7 derniers jours", () => {
    expect(definitionsRaccourcis(MAINTENANT).map((r) => [r.cle, r.href])).toEqual([
      ["eleve", "/admin/alertes?niveau=eleve"],
      ["absences", "/admin/alertes?type=absences"],
      ["recentes", "/admin/alertes?du=2026-10-14"],
    ]);
  });

  it("7 derniers jours : aujourd'hui compris, à l'heure du Bénin, date annoncée en clair", () => {
    expect(debutSeptDerniersJours(MAINTENANT)).toBe("2026-10-14");
    // 23 h 30 UTC = 0 h 30 le lendemain à Porto-Novo
    expect(debutSeptDerniersJours(new Date("2026-10-20T23:30:00Z"))).toBe("2026-10-15");
    expect(definitionsRaccourcis(MAINTENANT)[2].precision).toBe("depuis le 14 octobre");
  });

  it("libellés explicites, sans flèche ni texte vague", () => {
    for (const r of definitionsRaccourcis(MAINTENANT)) {
      expect(`${r.libelle.un} ${r.libelle.plusieurs}`).not.toMatch(/[→›»]|avancé|cliquez|ici/i);
      expect(r.precision.length).toBeGreaterThan(5);
    }
  });

  it("compteurs : la requête de la page Alertes (alertes actives seulement, filtre de l'accès)", async () => {
    mockCount.mockResolvedValueOnce(3).mockResolvedValueOnce(2).mockResolvedValueOnce(5);
    const r = await raccourcisAlertes({ type: "toutes" }, MAINTENANT);
    expect(r.map((x) => x.total)).toEqual([3, 2, 5]);
    const where = mockCount.mock.calls.map((c) => c[0].where);
    expect(where.every((w) => w.statut === "active")).toBe(true);
    expect(where[0].niveauRisque).toBe("eleve");
    expect(where[1].type).toBe("absences");
    expect(where[2].createdAt.gte.toISOString()).toBe("2026-10-13T23:00:00.000Z"); // 14 octobre, 0 h à Porto-Novo
  });

  it("le nombre et son libellé forment une phrase, accordée (« 13 alertes détectées sur les 7 derniers jours »)", async () => {
    mockCount.mockResolvedValueOnce(13).mockResolvedValueOnce(1).mockResolvedValueOnce(13);
    const r = await raccourcisAlertes({ type: "toutes" }, MAINTENANT);
    expect(r.map((x) => `${x.total} ${x.libelle}`)).toEqual([
      "13 alertes à risque élevé",
      "1 alerte pour absences répétées",
      "13 alertes détectées sur les 7 derniers jours",
    ]);
    mockCount.mockResolvedValue(0);
    expect((await raccourcisAlertes({ type: "toutes" }, MAINTENANT))[2].libelle).toBe("alerte détectée sur les 7 derniers jours");
  });

  it("portée sans établissement : zéro, sans requête", async () => {
    const r = await raccourcisAlertes({ type: "aucune" }, MAINTENANT);
    expect(r.every((x) => x.total === 0)).toBe(true);
    expect(mockCount).not.toHaveBeenCalled();
  });
});
