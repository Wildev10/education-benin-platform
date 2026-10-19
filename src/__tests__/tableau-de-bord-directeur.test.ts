import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest, type NextFetchEvent } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
// auth(handler) enveloppe le middleware du proxy ; auth() renvoie la session
vi.mock("@/auth", () => ({
  auth: (arg?: unknown) => (typeof arg === "function" ? arg : mockAuth()),
}));

class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

vi.mock("@/app/directeur/DirecteurCharts", () => ({
  GraphiqueEvolution: () => null,
  GraphiqueNiveaux: () => null,
}));

const prismaMock = {
  etablissement: { findUnique: vi.fn() },
  etudiant: { findMany: vi.fn() },
  alerte: { findMany: vi.fn() },
  note: { groupBy: vi.fn() },
  absence: { count: vi.fn(), findMany: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// Import AFTER mocks are set up
const { default: DirecteurPage } = await import("@/app/directeur/page");
const { getTableauDeBordDirecteur, resoudreAccesDirecteur } = await import(
  "@/lib/tableau-de-bord-directeur"
);
const { proxy } = await import("@/proxy");

// ── Helpers ──────────────────────────────────────────────────────────────────

const ETAB = "etab-notre-dame";

function session(role: string, etablissementId: string | null = null) {
  return {
    user: { id: "u1", name: "Test", email: "t@edutech.bj", role, etudiantId: null, etablissementId },
    expires: "2099-01-01",
  };
}

async function rendre() {
  try {
    return { html: renderToStaticMarkup(await DirecteurPage()), redirection: null };
  } catch (e) {
    if (e instanceof RedirectError) return { html: null, redirection: e.url };
    throw e;
  }
}

function alerte(
  id: string,
  etudiantId: string,
  niveauRisque: "eleve" | "moyen",
  ecartPourcent: number,
  createdAt = "2026-10-01T10:00:00Z"
) {
  return {
    id,
    etudiantId,
    niveauRisque,
    type: "baisse_moyenne",
    periode: "Trimestre 3",
    moyenneApres: 8.5,
    ecartPourcent,
    createdAt: new Date(createdAt),
    etudiant: { nom: `Nom-${etudiantId}`, prenom: `Prenom-${etudiantId}`, niveau: "Seconde C" },
  };
}

function groupe(cle: Record<string, string>, somme: number, nb: number) {
  return { ...cle, _sum: { valeur: somme }, _count: { valeur: nb } };
}

function chargerDonnees() {
  prismaMock.etablissement.findUnique.mockResolvedValue({
    id: ETAB,
    nom: "Collège Notre-Dame",
    departement: "Ouémé",
    commune: "Porto-Novo",
  });
  prismaMock.etudiant.findMany.mockResolvedValue([
    { id: "e1", niveau: "Seconde C" },
    { id: "e2", niveau: "Seconde C" },
    { id: "e3", niveau: "Terminale D" },
    { id: "e4", niveau: "Première D" },
  ]);
  prismaMock.alerte.findMany.mockResolvedValue([
    alerte("a1", "e1", "moyen", 16),
    alerte("a2", "e2", "eleve", 25),
    alerte("a3", "e2", "eleve", 40), // même élève : ne doit apparaître qu'une fois
    alerte("a4", "e3", "eleve", 30),
  ]);
  prismaMock.note.groupBy.mockImplementation(({ by }: { by: string[] }) =>
    Promise.resolve(
      by.includes("periode")
        ? [
            groupe({ anneeScolaire: "2025-2026", periode: "Trimestre 2" }, 120, 10),
            groupe({ anneeScolaire: "2025-2026", periode: "Trimestre 1" }, 130, 10),
            groupe({ anneeScolaire: "2024-2025", periode: "Trimestre 3" }, 100, 10),
          ]
        : [
            groupe({ etudiantId: "e1", anneeScolaire: "2025-2026" }, 60, 5),
            groupe({ etudiantId: "e2", anneeScolaire: "2025-2026" }, 40, 5),
            groupe({ etudiantId: "e3", anneeScolaire: "2025-2026" }, 150, 10),
            groupe({ etudiantId: "e4", anneeScolaire: "2024-2025" }, 50, 5), // autre année : ignoré
          ]
    )
  );
  prismaMock.absence.count.mockResolvedValue(3);
  prismaMock.absence.findMany.mockResolvedValue([
    {
      id: "abs1",
      date: new Date("2026-10-09T00:00:00Z"),
      periode: "Trimestre 1",
      etudiant: { id: "e1", nom: "Hane", prenom: "Katlyn", niveau: "Seconde C" },
    },
  ]);
}

function reinitialiser() {
  for (const modele of Object.values(prismaMock)) {
    for (const fn of Object.values(modele)) fn.mockReset();
  }
  mockAuth.mockReset();
}

// ── Contrôle d'accès ─────────────────────────────────────────────────────────

describe("resoudreAccesDirecteur", () => {
  it.each([
    ["non connecté", null, "non-connecte"],
    ["enseignant", session("enseignant", ETAB), "interdit"],
    ["étudiant", session("etudiant"), "interdit"],
    ["admin", session("admin"), "interdit"],
    ["directeur sans établissement", session("directeur", null), "sans-etablissement"],
    ["directeur rattaché", session("directeur", ETAB), "ok"],
  ])("%s → %s", (_nom, s, statut) => {
    expect(resoudreAccesDirecteur(s as never).statut).toBe(statut);
  });
});

describe("Page /directeur", () => {
  beforeEach(() => {
    reinitialiser();
    chargerDonnees();
  });

  it("utilisateur non connecté → redirigé vers /login, aucune donnée lue", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await rendre()).redirection).toBe("/login");
    expect(prismaMock.etablissement.findUnique).not.toHaveBeenCalled();
  });

  it.each(["enseignant", "etudiant", "admin"])(
    "%s → refusé (redirigé vers /), aucune donnée lue",
    async (role) => {
      mockAuth.mockResolvedValue(session(role, ETAB));
      expect((await rendre()).redirection).toBe("/");
      expect(prismaMock.alerte.findMany).not.toHaveBeenCalled();
    }
  );

  it("directeur sans établissement → message clair, ni données vides ni globales", async () => {
    mockAuth.mockResolvedValue(session("directeur", null));
    const { html } = await rendre();
    expect(html).toContain("Aucun établissement rattaché à votre compte");
    expect(html).not.toContain("Moyenne générale");
    for (const modele of Object.values(prismaMock)) {
      for (const fn of Object.values(modele)) expect(fn).not.toHaveBeenCalled();
    }
  });

  it("directeur dont l'établissement n'existe plus → même message", async () => {
    mockAuth.mockResolvedValue(session("directeur", "etab-supprime"));
    prismaMock.etablissement.findUnique.mockResolvedValue(null);
    const { html } = await rendre();
    expect(html).toContain("Aucun établissement rattaché à votre compte");
  });

  it("directeur rattaché → tableau de bord de son établissement", async () => {
    mockAuth.mockResolvedValue(session("directeur", ETAB));
    const { html } = await rendre();
    expect(html).toContain("Collège Notre-Dame");
    expect(html).toContain("Département Ouémé");
    expect(html).toContain("Moyenne générale");
    expect(html).toContain("Élevé : 3 · Moyen : 1");
    expect(html).toContain("12,50");
    expect(html).toContain("8,50/20");
    expect(html).toContain("Prenom-e2 Nom-e2");
    expect(html).toContain('href="/enseignant/etudiants/e2"');
    expect(html).toContain("Katlyn Hane");
    expect(prismaMock.etablissement.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ETAB } })
    );
  });
});

// ── Filtrage par établissement ───────────────────────────────────────────────

describe("getTableauDeBordDirecteur — filtrage", () => {
  beforeEach(() => {
    reinitialiser();
    chargerDonnees();
  });

  it("toutes les requêtes sont restreintes à l'établissement du directeur", async () => {
    await getTableauDeBordDirecteur(ETAB, new Date(2026, 9, 19));

    expect(prismaMock.etablissement.findUnique.mock.calls[0][0].where).toEqual({ id: ETAB });
    expect(prismaMock.etudiant.findMany.mock.calls[0][0].where).toEqual({ etablissementId: ETAB });

    const viaEtudiant = [
      prismaMock.alerte.findMany,
      prismaMock.note.groupBy,
      prismaMock.absence.count,
      prismaMock.absence.findMany,
    ];
    for (const fn of viaEtudiant) {
      expect(fn).toHaveBeenCalled();
      for (const [args] of fn.mock.calls) {
        expect(args.where.etudiant).toEqual({ etablissementId: ETAB });
      }
    }
  });

  it("absences : injustifiées du mois en cours uniquement", async () => {
    await getTableauDeBordDirecteur(ETAB, new Date(2026, 9, 19));
    const where = prismaMock.absence.count.mock.calls[0][0].where;
    expect(where.motif).toBe("injustifiee");
    expect(where.date.gte).toEqual(new Date(2026, 9, 1));
    expect(where.date.lt).toEqual(new Date(2026, 10, 1));
    expect(prismaMock.absence.findMany.mock.calls[0][0]).toMatchObject({
      where: { motif: "injustifiee" },
      take: 5,
    });
  });
});

// ── Calculs ──────────────────────────────────────────────────────────────────

describe("getTableauDeBordDirecteur — indicateurs", () => {
  beforeEach(() => {
    reinitialiser();
    chargerDonnees();
  });

  it("calcule les chiffres clés", async () => {
    const tdb = (await getTableauDeBordDirecteur(ETAB, new Date(2026, 9, 19)))!;
    expect(tdb.nbEleves).toBe(4);
    expect(tdb.anneeScolaire).toBe("2025-2026");
    expect(tdb.moyenneGenerale).toBe(12.5); // (120 + 130) / 20 sur l'année la plus récente
    expect(tdb.alertes).toEqual({ total: 4, eleve: 3, moyen: 1 });
    expect(tdb.nbElevesEnAlerte).toBe(3);
    expect(tdb.tauxElevesEnAlerte).toBe(75);
    expect(tdb.absencesInjustifieesMois).toBe(3);
    expect(tdb.mois).toBe("octobre 2026");
  });

  it("évolution triée chronologiquement, avec l'année si plusieurs années", async () => {
    const tdb = (await getTableauDeBordDirecteur(ETAB))!;
    expect(tdb.evolution).toEqual([
      { periode: "Trimestre 3 (2024-2025)", moyenne: 10 },
      { periode: "Trimestre 1 (2025-2026)", moyenne: 13 },
      { periode: "Trimestre 2 (2025-2026)", moyenne: 12 },
    ]);
  });

  it("moyennes par classe sur l'année de référence, classées par niveau", async () => {
    const tdb = (await getTableauDeBordDirecteur(ETAB))!;
    expect(tdb.moyennesParNiveau).toEqual([
      { niveau: "Seconde C", moyenne: 10, eleves: 2 },
      { niveau: "Terminale D", moyenne: 15, eleves: 1 },
    ]);
  });

  it("élèves à risque : élevé d'abord, plus forte baisse, un seul par élève", async () => {
    const tdb = (await getTableauDeBordDirecteur(ETAB))!;
    expect(tdb.elevesARisque.map((e) => [e.etudiantId, e.alerteId])).toEqual([
      ["e2", "a3"],
      ["e3", "a4"],
      ["e1", "a1"],
    ]);
  });

  it("sans élèves ni notes : pas de division par zéro", async () => {
    prismaMock.etudiant.findMany.mockResolvedValue([]);
    prismaMock.alerte.findMany.mockResolvedValue([]);
    prismaMock.note.groupBy.mockResolvedValue([]);
    const tdb = (await getTableauDeBordDirecteur(ETAB))!;
    expect(tdb.moyenneGenerale).toBeNull();
    expect(tdb.tauxElevesEnAlerte).toBe(0);
    expect(tdb.evolution).toEqual([]);
  });
});

// ── Proxy ────────────────────────────────────────────────────────────────────

describe("proxy — /directeur", () => {
  async function acceder(role: string | null) {
    const req = new NextRequest("http://localhost/directeur") as NextRequest & { auth: unknown };
    req.auth = role ? session(role, ETAB) : null;
    const res = await proxy(req, {} as NextFetchEvent);
    return res?.headers.get("location") ?? null;
  }

  it("laisse passer le directeur", async () => {
    expect(await acceder("directeur")).toBeNull();
  });

  it.each(["enseignant", "etudiant", "admin"])("redirige %s vers /", async (role) => {
    expect(await acceder(role)).toBe("http://localhost/");
  });

  it("redirige un visiteur non connecté vers /login", async () => {
    expect(await acceder(null)).toBe("http://localhost/login");
  });
});
