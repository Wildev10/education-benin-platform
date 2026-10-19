import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NotificationAlerte } from "@/lib/notifications";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth-guard", () => ({ requireRole: mockRequireRole }));

const mockFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { alerte: { findMany: mockFindMany } },
}));

// Import AFTER mocks are set up
const { GET } = await import("@/app/api/notifications/alertes/route");
const { getAlertesRecentes } = await import("@/lib/notifications-server");
const { fusionnerNotifications, compterNonLues, FENETRE_NOTIFICATIONS_MS } = await import(
  "@/lib/notifications"
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function session(role: string, etablissementId: string | null = null) {
  return { user: { id: "u1", role, etudiantId: null, etablissementId } };
}

function alerteDb(id: string, createdAt: Date) {
  return {
    id,
    etudiantId: "etu-1",
    type: "baisse_moyenne",
    niveauRisque: "eleve",
    moyenneAvant: 14,
    moyenneApres: 9,
    ecartPourcent: 35,
    periode: "Trimestre 1",
    anneeScolaire: "2025-2026",
    statut: "active",
    createdAt,
    etudiant: {
      id: "etu-1",
      nom: "Agossou",
      prenom: "Koffi",
      niveau: "3ème",
      etablissement: { id: "etab-1", nom: "CEG Akpakpa" },
    },
  };
}

function notif(id: string, createdAt: string): NotificationAlerte {
  return {
    id,
    type: "absences",
    niveauRisque: "moyen",
    createdAt,
    etudiant: { id: "e", nom: "N", prenom: "P", niveau: "6ème" },
    etablissement: { id: "x", nom: "Etab" },
  };
}

// ── Route GET /api/notifications/alertes ─────────────────────────────────────

describe("GET /api/notifications/alertes — contrôle d'accès", () => {
  beforeEach(() => {
    mockFindMany.mockReset().mockResolvedValue([]);
    mockRequireRole.mockReset();
  });

  it("n'autorise que les rôles admin et directeur", async () => {
    mockRequireRole.mockResolvedValue(session("admin"));
    await GET();
    expect(mockRequireRole).toHaveBeenCalledWith(["admin", "directeur"]);
  });

  it("propage le 403 renvoyé par la garde (ex. enseignant)", async () => {
    mockRequireRole.mockResolvedValue(
      Response.json({ error: "Acces interdit" }, { status: 403 })
    );
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("propage le 401 si non authentifié", async () => {
    mockRequireRole.mockResolvedValue(
      Response.json({ error: "Non authentifie" }, { status: 401 })
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("admin : aucune restriction d'établissement", async () => {
    mockRequireRole.mockResolvedValue(session("admin"));
    const res = await GET();
    expect(res.status).toBe(200);
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.etudiant).toBeUndefined();
    expect(where.statut).toBe("active");
  });

  it("directeur : restreint à son établissement", async () => {
    mockRequireRole.mockResolvedValue(session("directeur", "etab-42"));
    await GET();
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.etudiant).toEqual({ etablissementId: "etab-42" });
  });

  it("directeur sans établissement : liste vide, aucune requête", async () => {
    mockRequireRole.mockResolvedValue(session("directeur", null));
    const res = await GET();
    expect(await res.json()).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("renvoie 500 si la base échoue", async () => {
    mockRequireRole.mockResolvedValue(session("admin"));
    mockFindMany.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

// ── getAlertesRecentes ───────────────────────────────────────────────────────

describe("getAlertesRecentes", () => {
  beforeEach(() => mockFindMany.mockReset());

  it("filtre sur les 5 dernières minutes et sérialise le résultat", async () => {
    const maintenant = new Date("2026-10-19T10:00:00.000Z");
    mockFindMany.mockResolvedValue([alerteDb("a1", new Date("2026-10-19T09:58:00.000Z"))]);

    const res = await getAlertesRecentes(null, maintenant);

    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.createdAt.gte.getTime()).toBe(maintenant.getTime() - FENETRE_NOTIFICATIONS_MS);
    expect(res).toEqual([
      {
        id: "a1",
        type: "baisse_moyenne",
        niveauRisque: "eleve",
        createdAt: "2026-10-19T09:58:00.000Z",
        etudiant: { id: "etu-1", nom: "Agossou", prenom: "Koffi", niveau: "3ème" },
        etablissement: { id: "etab-1", nom: "CEG Akpakpa" },
      },
    ]);
  });
});

// ── Logique client (lu / non lu) ─────────────────────────────────────────────

describe("fusionnerNotifications", () => {
  it("dédoublonne, trie du plus récent au plus ancien et limite à 5", () => {
    const existantes = [notif("a", "2026-10-19T09:00:00Z"), notif("b", "2026-10-19T09:01:00Z")];
    const nouvelles = [
      notif("b", "2026-10-19T09:01:00Z"),
      ...["c", "d", "e", "f"].map((id, i) => notif(id, `2026-10-19T09:0${i + 2}:00Z`)),
    ];
    const res = fusionnerNotifications(existantes, nouvelles);
    expect(res.map((n) => n.id)).toEqual(["f", "e", "d", "c", "b"]);
  });
});

describe("compterNonLues", () => {
  const liste = [notif("a", "2026-10-19T09:00:00.000Z"), notif("b", "2026-10-19T09:05:00.000Z")];

  it("tout est non lu si le dropdown n'a jamais été ouvert", () => {
    expect(compterNonLues(liste, null)).toBe(2);
  });

  it("ne compte que les alertes postérieures à la dernière ouverture", () => {
    expect(compterNonLues(liste, "2026-10-19T09:02:00.000Z")).toBe(1);
    expect(compterNonLues(liste, "2026-10-19T09:10:00.000Z")).toBe(0);
  });
});
