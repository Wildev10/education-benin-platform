import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest, type NextFetchEvent } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: (arg?: unknown) => (typeof arg === "function" ? arg : mockAuth()) }));
const mockRequireRole = vi.fn();
vi.mock("@/lib/auth-guard", () => ({ requireRole: mockRequireRole }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
// user.findMany : candidats responsables de la fiche
const prismaMock = { etudiant: { findUnique: vi.fn() }, user: { findMany: vi.fn().mockResolvedValue([]) } };
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/components/ExportPdfButton", () => ({ ExportPdfButton: () => null, ExportExcelButton: () => null }));

const perimetre = await import("@/lib/perimetre");
const { navDirecteur } = await import("@/app/(fr)/(espaces)/directeur/navigation");
const { proxy } = await import("@/proxy");
const { default: StudentDetail } = await import("@/app/(fr)/(espaces)/enseignant/etudiants/[id]/StudentDetail");
const { default: FichePage } = await import("@/app/(fr)/(espaces)/enseignant/etudiants/[id]/page");

const ROLES = ["etudiant", "enseignant", "directeur", "admin"] as const;

// ── Règles partagées par l'interface et l'API ────────────────────────────────

describe("règles partagées", () => {
  it("listes identiques à celles des routes de l'API", () => {
    expect(perimetre.ROLES_SUPPRESSION_ABSENCE).toEqual(["admin", "enseignant"]);
    expect(perimetre.ROLES_IMPORT_NOTES).toEqual(["admin", "enseignant"]);
    // Suivi des alertes : l'établissement agit, l'admin consulte
    expect(perimetre.ROLES_TRAITEMENT_ALERTES).toEqual(["enseignant", "directeur"]);
  });

  it.each(ROLES)("%s : suppression d'absence et import selon la règle", (role) => {
    const autorise = role === "admin" || role === "enseignant";
    expect(perimetre.peutSupprimerAbsence(role)).toBe(autorise);
    expect(perimetre.peutImporterNotes(role)).toBe(autorise);
  });

  it("rôle absent : rien n'est autorisé", () => {
    expect(perimetre.peutSupprimerAbsence(undefined)).toBe(false);
    expect(perimetre.peutImporterNotes(undefined)).toBe(false);
  });

  it("l'API utilise les mêmes listes que l'interface", async () => {
    mockRequireRole.mockResolvedValue(Response.json({ error: "Acces interdit" }, { status: 403 }));
    const { DELETE } = await import("@/app/api/absences/[id]/route");
    const { POST } = await import("@/app/api/notes/import/route");
    await DELETE(new Request("http://x/api/absences/a1", { method: "DELETE" }), { params: Promise.resolve({ id: "a1" }) });
    expect(mockRequireRole).toHaveBeenLastCalledWith(perimetre.ROLES_SUPPRESSION_ABSENCE);
    const res = await POST(new Request("http://x/api/notes/import", { method: "POST" }));
    expect(mockRequireRole).toHaveBeenLastCalledWith(perimetre.ROLES_IMPORT_NOTES);
    expect(res.status).toBe(403);
  });
});

// ── Directeur : pas d'import ─────────────────────────────────────────────────

describe("import de notes pour le directeur", () => {
  it("absent de sa navigation", () => {
    expect(navDirecteur.map((i) => i.href)).not.toContain("/enseignant/import");
    expect(navDirecteur.map((i) => i.label)).not.toContain("Importer");
  });

  async function ouvrir(role: string, chemin: string) {
    const req = new NextRequest(`http://localhost${chemin}`) as NextRequest & { auth: unknown };
    req.auth = { user: { role } };
    const res = await proxy(req, {} as NextFetchEvent);
    return res?.headers.get("location") ?? null;
  }

  it("page /enseignant/import : directeur renvoyé vers son accueil, enseignant et admin admis", async () => {
    expect(await ouvrir("directeur", "/enseignant/import")).toBe("http://localhost/");
    expect(await ouvrir("enseignant", "/enseignant/import")).toBeNull();
    expect(await ouvrir("admin", "/enseignant/import")).toBeNull();
  });

  it("le reste de l'espace enseignant reste ouvert au directeur", async () => {
    expect(await ouvrir("directeur", "/enseignant")).toBeNull();
    expect(await ouvrir("directeur", "/enseignant/assistant")).toBeNull();
  });
});

// ── Fiche élève : bouton « Supprimer » d'une absence ─────────────────────────

const absence = { id: "abs-1", date: "2026-10-01T00:00:00.000Z", motif: "injustifiee", periode: "Trimestre 1", anneeScolaire: "2025-2026" };

describe("bouton « Supprimer » d'une absence", () => {
  const rendu = (peutSupprimerAbsence: boolean) =>
    renderToStaticMarkup(<StudentDetail etudiantId="e1" anneeScolaire="2026-2027" periodeParDefaut="Trimestre 1" initialNotes={[]} initialAbsences={[absence]} peutSupprimerAbsence={peutSupprimerAbsence} />);

  it("affiché quand la suppression est permise", () => {
    expect(rendu(true)).toMatch(/aria-label="Supprimer l&#x27;absence du/);
  });

  it("masqué sinon (et par défaut), l'absence restant listée", () => {
    const html = rendu(false);
    expect(html).not.toContain("Supprimer");
    expect(html).toContain("Injustifiée");
    expect(renderToStaticMarkup(<StudentDetail etudiantId="e1" anneeScolaire="2026-2027" periodeParDefaut="Trimestre 1" initialNotes={[]} initialAbsences={[absence]} />)).not.toContain("Supprimer");
  });

  /** Props passées à StudentDetail par la page de la fiche, pour un rôle. */
  async function propsFiche(role: string) {
    mockAuth.mockResolvedValue({ user: { id: "u1", role, etablissementId: "etab-1", etudiantId: null } });
    prismaMock.etudiant.findUnique.mockResolvedValue({
      id: "e1",
      nom: "N",
      prenom: "P",
      niveau: "Seconde C",
      etablissementId: "etab-1",
      etablissement: { nom: "Lycée" },
      notes: [],
      absences: [],
      alertes: [],
    });
    const page = (await FichePage({ params: Promise.resolve({ id: "e1" }) })) as ReactElement<{ children: ReactNode }>;
    const trouver = (n: ReactNode): Record<string, unknown> | null => {
      if (Array.isArray(n)) return n.map(trouver).find(Boolean) ?? null;
      if (!isValidElement(n)) return null;
      if (n.type === StudentDetail) return n.props as Record<string, unknown>;
      return trouver((n.props as { children?: ReactNode }).children);
    };
    return trouver(page);
  }

  it.each([
    ["enseignant", true],
    ["admin", true],
    ["directeur", false],
  ])("fiche consultée par %s : peutSupprimerAbsence = %s", async (role, attendu) => {
    expect((await propsFiche(role))?.peutSupprimerAbsence).toBe(attendu);
  });
});
