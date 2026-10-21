import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { NextRequest, type NextFetchEvent } from "next/server";
import { Prisma } from "@/generated/prisma/client";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({
  auth: (arg?: unknown) => (typeof arg === "function" ? arg : mockAuth()),
}));

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth-guard", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAction: vi.fn() }));

class NavigationError extends Error {
  constructor(public kind: string, public url?: string) {
    super(kind);
  }
}
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NavigationError("notFound");
  },
  redirect: (url: string) => {
    throw new NavigationError("redirect", url);
  },
}));

// Composant client de la fiche (notes, absences et alertes) : remplacé par un marqueur
const StudentDetailMock = vi.fn(() => null);
vi.mock("@/app/(fr)/(espaces)/enseignant/etudiants/[id]/StudentDetail", () => ({ default: StudentDetailMock }));
vi.mock("@/components/ExportPdfButton", () => ({ ExportPdfButton: () => null, ExportExcelButton: () => null }));

const prismaMock = {
  etudiant: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// Import AFTER mocks are set up
const { default: FichePage } = await import("@/app/(fr)/(espaces)/enseignant/etudiants/[id]/page");
const utilisateurs = await import("@/app/api/admin/utilisateurs/[id]/route");
const { proxy } = await import("@/proxy");
const { peutTraiterAlertes } = await import("@/lib/perimetre");

// ── Helpers ──────────────────────────────────────────────────────────────────

const MON_ETAB = "etab-mathieu-bouke";
const ELEVE = (etablissementId: string) => ({
  id: "eleve-1",
  nom: "Rau",
  prenom: "Elwin",
  niveau: "Seconde C",
  etablissementId,
  etablissement: { nom: "Lycée" },
  notes: [],
  absences: [],
  alertes: [
    {
      id: "a1",
      type: "baisse_moyenne",
      niveauRisque: "eleve",
      statut: "active",
      periode: "Trimestre 3",
      moyenneAvant: 12,
      moyenneApres: 8,
      ecartPourcent: 33,
      createdAt: new Date("2026-10-01T10:00:00Z"),
    },
  ],
});

function session(role: string, etablissementId: string | null = null) {
  return { user: { id: "u1", role, etablissementId, etudiantId: null } };
}

async function ouvrirFiche(id = "eleve-1") {
  try {
    return { page: await FichePage({ params: Promise.resolve({ id }) }), erreur: null };
  } catch (e) {
    if (e instanceof NavigationError) return { page: null, erreur: e };
    throw e;
  }
}

/** Retrouve les props passées à un composant dans l'arbre JSX renvoyé par la page. */
function propsDe(noeud: ReactNode, composant: unknown): Record<string, unknown> | null {
  if (Array.isArray(noeud)) {
    for (const n of noeud) {
      const r = propsDe(n, composant);
      if (r) return r;
    }
    return null;
  }
  if (!isValidElement(noeud)) return null;
  const el = noeud as ReactElement<{ children?: ReactNode }>;
  if (el.type === composant) return el.props as Record<string, unknown>;
  return propsDe(el.props.children, composant);
}

function erreurPrisma(code: string) {
  return new Prisma.PrismaClientKnownRequestError("introuvable", { code, clientVersion: "test" });
}

beforeEach(() => {
  mockAuth.mockReset();
  mockRequireRole.mockReset();
  for (const modele of Object.values(prismaMock)) {
    for (const fn of Object.values(modele)) fn.mockReset();
  }
});

// ── 1. Bouton « Marquer comme traitée » ──────────────────────────────────────

describe("peutTraiterAlertes", () => {
  it.each([
    ["admin", true],
    ["enseignant", true],
    ["directeur", false],
    ["etudiant", false],
    [undefined, false],
  ])("%s → %s", (role, attendu) => {
    expect(peutTraiterAlertes(role)).toBe(attendu);
  });
});

describe("Fiche élève : section alertes", () => {
  it("enseignant de l'établissement : alertes affichées avec le bouton", async () => {
    mockAuth.mockResolvedValue(session("enseignant", MON_ETAB));
    prismaMock.etudiant.findUnique.mockResolvedValue(ELEVE(MON_ETAB));
    const { page } = await ouvrirFiche();
    const props = propsDe(page, StudentDetailMock);
    expect(props?.peutTraiter).toBe(true);
    expect(props?.initialAlertes).toEqual([
      expect.objectContaining({ id: "a1", statut: "active", createdAt: "2026-10-01T10:00:00.000Z" }),
    ]);
  });

  it("directeur de l'établissement : alertes affichées sans le bouton", async () => {
    mockAuth.mockResolvedValue(session("directeur", MON_ETAB));
    prismaMock.etudiant.findUnique.mockResolvedValue(ELEVE(MON_ETAB));
    const { page } = await ouvrirFiche();
    expect(propsDe(page, StudentDetailMock)?.peutTraiter).toBe(false);
  });
});

// ── 2. Fiche d'un élève hors périmètre → page introuvable ────────────────────

describe("Fiche élève : hors périmètre = introuvable", () => {
  it.each([
    ["enseignant", session("enseignant", MON_ETAB)],
    ["directeur", session("directeur", MON_ETAB)],
    ["enseignant sans établissement", session("enseignant", null)],
  ])("%s qui force l'id d'un élève d'un autre établissement → notFound()", async (_r, s) => {
    mockAuth.mockResolvedValue(s);
    prismaMock.etudiant.findUnique.mockResolvedValue(ELEVE("autre-etab"));
    const { erreur } = await ouvrirFiche();
    expect(erreur?.kind).toBe("notFound");
  });

  it("élève inexistant → la même page introuvable", async () => {
    mockAuth.mockResolvedValue(session("enseignant", MON_ETAB));
    prismaMock.etudiant.findUnique.mockResolvedValue(null);
    expect((await ouvrirFiche("n-existe-pas")).erreur?.kind).toBe("notFound");
  });

  it("non connecté → /login, sans lire la base", async () => {
    mockAuth.mockResolvedValue(null);
    const { erreur } = await ouvrirFiche();
    expect(erreur).toMatchObject({ kind: "redirect", url: "/login" });
    expect(prismaMock.etudiant.findUnique).not.toHaveBeenCalled();
  });
});

describe("Proxy : un étudiant ouvre une fiche élève", () => {
  async function acceder(role: string, chemin: string) {
    const req = new NextRequest(`http://localhost${chemin}`) as NextRequest & { auth: unknown };
    req.auth = session(role);
    const res = await proxy(req, {} as NextFetchEvent);
    return {
      reecriture: res?.headers.get("x-middleware-rewrite") ?? null,
      redirection: res?.headers.get("location") ?? null,
    };
  }

  it.each(["/enseignant/etudiants/eleve-autre", "/admin/etudiants/eleve-autre", "/enseignant/etudiants/eleve-autre/x"])(
    "%s → page introuvable (réécriture, pas de redirection)",
    async (chemin) => {
      const r = await acceder("etudiant", chemin);
      expect(r.reecriture).toBe("http://localhost/_introuvable");
      expect(r.redirection).toBeNull();
    }
  );

  it("les autres pages interdites restent redirigées comme avant", async () => {
    expect((await acceder("etudiant", "/enseignant")).redirection).toBe("http://localhost/");
  });

  it("l'enseignant n'est pas concerné par la réécriture", async () => {
    expect(await acceder("enseignant", "/enseignant/etudiants/eleve-1")).toEqual({
      reecriture: null,
      redirection: null,
    });
  });
});

// ── 3. /api/admin/utilisateurs/[id] avec un identifiant inexistant ───────────

describe("/api/admin/utilisateurs/[id] — identifiant inexistant", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const patch = (id: string, body: unknown) =>
    utilisateurs.PATCH(
      new Request(`http://localhost/api/admin/utilisateurs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      ctx(id)
    );
  const supprimer = (id: string) =>
    utilisateurs.DELETE(new Request(`http://localhost/api/admin/utilisateurs/${id}`, { method: "DELETE" }), ctx(id));

  beforeEach(() => {
    mockRequireRole.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("PATCH → 404, aucune écriture", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await patch("n-existe-pas", { nom: "Test" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Utilisateur introuvable." });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("PATCH → 404 si l'utilisateur disparaît entre la lecture et l'écriture", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "enseignant" });
    prismaMock.user.update.mockRejectedValue(erreurPrisma("P2025"));
    expect((await patch("u-supprime", { nom: "Test" })).status).toBe(404);
  });

  it("PATCH : une autre erreur de base reste une 500", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "enseignant" });
    prismaMock.user.update.mockRejectedValue(erreurPrisma("P1001"));
    expect((await patch("u1", { nom: "Test" })).status).toBe(500);
  });

  it("PATCH sur un utilisateur existant → 200", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "enseignant" });
    prismaMock.user.update.mockResolvedValue({ id: "u1", nom: "Test", prenom: "P", createdAt: new Date() });
    expect((await patch("u1", { nom: "Test" })).status).toBe(200);
  });

  it("DELETE → 404, aucune suppression", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    expect((await supprimer("n-existe-pas")).status).toBe(404);
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it("DELETE → 404 si l'utilisateur disparaît entre la lecture et la suppression", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", nom: "N", prenom: "P", role: "enseignant" });
    prismaMock.user.delete.mockRejectedValue(erreurPrisma("P2025"));
    expect((await supprimer("u1")).status).toBe(404);
  });
});
