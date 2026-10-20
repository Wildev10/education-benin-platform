import { describe, expect, it, vi } from "vitest";
import net from "node:net";
import { DELAI_TENTATIVE_PAR_ADRESSE_MS, avecNouvelleTentative, estErreurDeConnexion } from "@/lib/prisma";

const avecCode = (message: string, code: string) => Object.assign(new Error(message), { code });

describe("estErreurDeConnexion", () => {
  it.each([
    ["délai d'ouverture du pool pg", new Error("timeout exceeded when trying to connect")],
    ["connexion coupée pendant l'ouverture", new Error("Connection terminated due to connection timeout")],
    ["connexion inactive coupée par Neon", new Error("Connection terminated unexpectedly")],
    ["ETIMEDOUT (relayé par Prisma)", avecCode("Invalid `prisma.etudiant.count()` invocation", "ETIMEDOUT")],
    ["ECONNRESET", avecCode("read ECONNRESET", "ECONNRESET")],
    ["P1001 : base injoignable", avecCode("Can't reach database server", "P1001")],
    ["cause imbriquée", Object.assign(new Error("Erreur Prisma"), { cause: new Error("Connection terminated unexpectedly") })],
  ])("%s : oui", (_, erreur) => {
    expect(estErreurDeConnexion(erreur)).toBe(true);
  });

  it.each([
    ["contrainte d'unicité", avecCode("Unique constraint failed", "P2002")],
    ["enregistrement introuvable", avecCode("Record not found", "P2025")],
    ["erreur quelconque", new Error("division par zéro")],
    ["valeur non Error", "timeout exceeded when trying to connect"],
  ])("%s : non", (_, erreur) => {
    expect(estErreurDeConnexion(erreur)).toBe(false);
  });
});

describe("réglage réseau", () => {
  it("chaque adresse du pooler a au moins 2 s pour répondre (250 ms par défaut dans Node)", () => {
    expect(DELAI_TENTATIVE_PAR_ADRESSE_MS).toBe(2000);
    expect(net.getDefaultAutoSelectFamilyAttemptTimeout()).toBeGreaterThanOrEqual(2000);
  });
});

describe("avecNouvelleTentative", () => {
  const connexion = () => new Error("timeout exceeded when trying to connect");

  it("lecture : rejouée une fois après une erreur de connexion", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const executer = vi.fn().mockRejectedValueOnce(connexion()).mockResolvedValueOnce([{ id: "a" }]);
    await expect(avecNouvelleTentative("findMany", executer)).resolves.toEqual([{ id: "a" }]);
    expect(executer).toHaveBeenCalledTimes(2);
  });

  it("lecture : une seule nouvelle tentative, la seconde erreur remonte", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const executer = vi.fn().mockRejectedValue(connexion());
    await expect(avecNouvelleTentative("count", executer)).rejects.toThrow("timeout exceeded");
    expect(executer).toHaveBeenCalledTimes(2);
  });

  it.each(["create", "update", "upsert", "delete", "createMany", "updateMany", "deleteMany"])(
    "écriture (%s) : jamais rejouée, même sur une erreur de connexion",
    async (operation) => {
      const executer = vi.fn().mockRejectedValue(new Error("Connection terminated unexpectedly"));
      await expect(avecNouvelleTentative(operation, executer)).rejects.toThrow("Connection terminated");
      expect(executer).toHaveBeenCalledTimes(1);
    }
  );

  it("lecture : une erreur qui n'est pas de connexion n'est pas rejouée", async () => {
    const executer = vi.fn().mockRejectedValue(avecCode("Record not found", "P2025"));
    await expect(avecNouvelleTentative("findUniqueOrThrow", executer)).rejects.toThrow("Record not found");
    expect(executer).toHaveBeenCalledTimes(1);
  });

  it("succès : une seule exécution", async () => {
    const executer = vi.fn().mockResolvedValue(3);
    await expect(avecNouvelleTentative("count", executer)).resolves.toBe(3);
    expect(executer).toHaveBeenCalledTimes(1);
  });
});
