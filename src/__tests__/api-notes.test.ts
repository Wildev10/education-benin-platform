import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth-guard", () => ({
  requireRole: vi.fn().mockResolvedValue({
    user: {
      id: "user-test",
      role: "enseignant",
      etudiantId: null,
      etablissementId: "etab-test", // doit correspondre à l'établissement de l'étudiant mock
    },
  }),
}));

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    etudiant: { findUnique: mockFindUnique },
    note: { create: mockCreate },
  },
}));

vi.mock("@/lib/detection-alerte", () => ({
  detecterAlerte: vi.fn().mockResolvedValue(null),
}));

// Import AFTER mocks are set up
const { POST } = await import("@/app/api/notes/route");

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  etudiantId: "etudiant-test",
  matiere: "Mathématiques",
  valeur: 15,
  periode: "Trimestre 1",
  anneeScolaire: "2025-2026",
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/notes — validation des données", () => {
  beforeEach(() => {
    mockFindUnique.mockResolvedValue({
      id: "etudiant-test",
      etablissementId: "etab-test",
    });
    mockCreate.mockResolvedValue({
      id: "note-test",
      ...validBody,
      createdAt: new Date().toISOString(),
    });
  });

  it("17. valeur = 21 → erreur de validation (hors plage 0-20)", async () => {
    const res = await POST(makeRequest({ ...validBody, valeur: 21 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/0.*20|valeur/i);
  });

  it("18. valeur = -1 → erreur de validation (hors plage 0-20)", async () => {
    const res = await POST(makeRequest({ ...validBody, valeur: -1 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/0.*20|valeur/i);
  });

  it("19. valeur = 0 → valide (cas limite bas)", async () => {
    const res = await POST(makeRequest({ ...validBody, valeur: 0 }));
    expect(res.status).toBe(201);
  });

  it("20. valeur = 20 → valide (cas limite haut)", async () => {
    const res = await POST(makeRequest({ ...validBody, valeur: 20 }));
    expect(res.status).toBe(201);
  });

  it("21. matière absente dans le body → erreur 400", async () => {
    const { matiere: _, ...bodySansMatiere } = validBody;
    const res = await POST(makeRequest(bodySansMatiere));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/matiere|obligatoire/i);
  });
});
