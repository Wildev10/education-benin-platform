import { describe, it, expect, vi, beforeEach } from "vitest";

// Responsable du suivi : candidats, vérification, retrait au changement d'établissement.

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findMany: vi.fn(), findFirst: vi.fn() },
    alerte: { findMany: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { candidatsResponsables, nomResponsableValide, retirerResponsabilites } = await import("@/lib/responsables-server");

beforeEach(() => {
  for (const modele of Object.values(prismaMock)) for (const fn of Object.values(modele)) fn.mockReset();
});

describe("candidatsResponsables", () => {
  it("enseignants et directeur de l'établissement seulement, le directeur en tête", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: "e1", nom: "Gbaguidi", prenom: "Fulbert", role: "enseignant" },
      { id: "d1", nom: "Sossou", prenom: "Bernadette", role: "directeur" },
    ]);
    expect(await candidatsResponsables("etab-zopah")).toEqual([
      { id: "d1", nom: "Bernadette Sossou", role: "directeur" },
      { id: "e1", nom: "Fulbert Gbaguidi", role: "enseignant" },
    ]);
    expect(prismaMock.user.findMany.mock.calls[0][0].where).toEqual({ etablissementId: "etab-zopah", role: { in: ["enseignant", "directeur"] } });
  });
});

describe("nomResponsableValide", () => {
  it("compte du même établissement et de rôle enseignant ou directeur : son nom ; sinon null", async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce({ nom: "Gbaguidi", prenom: "Fulbert" }).mockResolvedValueOnce(null);
    expect(await nomResponsableValide("e1", "etab-zopah")).toBe("Fulbert Gbaguidi");
    expect(await nomResponsableValide("autre", "etab-zopah")).toBeNull();
    expect(prismaMock.user.findFirst.mock.calls[0][0].where).toEqual({ id: "e1", etablissementId: "etab-zopah", role: { in: ["enseignant", "directeur"] } });
  });
});

describe("retirerResponsabilites", () => {
  const compte = { id: "e1", nom: "Gbaguidi", prenom: "Fulbert" };

  it("changement d'établissement : alertes de l'ancien établissement « à désigner », avec une étape « Système »", async () => {
    prismaMock.alerte.findMany.mockResolvedValue([{ id: "a1", statut: "active", suiviDepuis: new Date("2026-10-01") }]);
    const n = await retirerResponsabilites(prismaMock, compte, { role: "enseignant", etablissementId: "etab-nouveau" });
    expect(n).toBe(1);
    expect(prismaMock.alerte.findMany.mock.calls[0][0].where).toEqual({
      responsableId: "e1",
      etudiant: { etablissementId: { not: "etab-nouveau" } },
    });
    const { data } = prismaMock.alerte.update.mock.calls[0][0];
    expect(data).toMatchObject({ responsableId: null, responsableDepuis: null });
    expect(data.suivis.create).toMatchObject({
      auteurNom: "Système",
      action: "retrait_responsable",
      statutAvant: "en_suivi",
      statutApres: "en_suivi",
      commentaire: "Fulbert Gbaguidi n'est plus dans l'établissement de l'élève : responsable à désigner.",
    });
  });

  it("rôle qui ne peut plus suivre (étudiant, admin) ou sans établissement : toutes ses responsabilités retirées", async () => {
    prismaMock.alerte.findMany.mockResolvedValue([]);
    await retirerResponsabilites(prismaMock, compte, { role: "admin", etablissementId: null });
    expect(prismaMock.alerte.findMany.mock.calls[0][0].where).toEqual({ responsableId: "e1" });
  });

  it("même établissement : rien n'est retiré", async () => {
    prismaMock.alerte.findMany.mockResolvedValue([]);
    expect(await retirerResponsabilites(prismaMock, compte, { role: "directeur", etablissementId: "etab-zopah" })).toBe(0);
    expect(prismaMock.alerte.update).not.toHaveBeenCalled();
  });
});
