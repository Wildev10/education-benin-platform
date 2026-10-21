import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NotificationAlerte } from "@/lib/notifications";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth-guard", () => ({ requireRole: mockRequireRole }));

const mockFindMany = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserUpdateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    alerte: { findMany: mockFindMany },
    user: { findUnique: mockUserFindUnique, updateMany: mockUserUpdateMany },
  },
}));

// Import AFTER mocks are set up
const { GET, POST } = await import("@/app/api/notifications/alertes/route");
const { getNotifications, marquerNotificationsVues } = await import("@/lib/notifications-server");
const { compterNonLues, estNonLue, FENETRE_NOTIFICATIONS_MS, MAX_NOTIFICATIONS } = await import("@/lib/notifications");

// ── Helpers ──────────────────────────────────────────────────────────────────

function session(role: string, etablissementId: string | null = null) {
  return { user: { id: "u1", role, etudiantId: null, etablissementId } };
}

function alerteDb(id: string, createdAt: Date, niveauModifieLe: Date | null = null) {
  return {
    id,
    etudiantId: "etu-1",
    type: "baisse_moyenne",
    niveauRisque: "eleve",
    moyenneAvant: 14,
    moyenneApres: 9,
    ecartPourcent: 35,
    periode: "Trimestre 1",
    anneeScolaire: "2026-2027",
    statut: "active",
    createdAt,
    niveauModifieLe,
    etudiant: {
      id: "etu-1",
      nom: "Agossou",
      prenom: "Koffi",
      niveau: "3ème",
      etablissement: { id: "etab-1", nom: "CEG Akpakpa" },
    },
  };
}

function notif(id: string, date: string, evenement: "creee" | "aggravee" = "creee"): NotificationAlerte {
  return {
    id,
    type: "absences",
    niveauRisque: "moyen",
    createdAt: date,
    evenement,
    date,
    etudiant: { id: "e", nom: "N", prenom: "P", niveau: "6ème" },
    etablissement: { id: "x", nom: "Etab" },
  };
}

const post = (corps: unknown) =>
  POST(new Request("http://localhost/api/notifications/alertes", { method: "POST", body: JSON.stringify(corps) }));

/** findMany : 1er appel = créations, 2e = aggravations */
const requetes = () => ({ creees: mockFindMany.mock.calls[0][0], aggravees: mockFindMany.mock.calls[1][0] });

beforeEach(() => {
  mockFindMany.mockReset().mockResolvedValue([]);
  mockUserFindUnique.mockReset().mockResolvedValue({ notificationsVuesLe: null });
  mockUserUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  mockRequireRole.mockReset();
});

// ── Route GET /api/notifications/alertes ─────────────────────────────────────

describe("GET /api/notifications/alertes — contrôle d'accès", () => {
  it("autorise l'admin, le directeur et l'enseignant", async () => {
    mockRequireRole.mockResolvedValue(session("admin"));
    await GET();
    expect(mockRequireRole).toHaveBeenCalledWith(["admin", "directeur", "enseignant"]);
  });

  it("propage le 403 renvoyé par la garde (ex. étudiant)", async () => {
    mockRequireRole.mockResolvedValue(Response.json({ error: "Acces interdit" }, { status: 403 }));
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("propage le 401 si non authentifié", async () => {
    mockRequireRole.mockResolvedValue(Response.json({ error: "Non authentifie" }, { status: 401 }));
    expect((await GET()).status).toBe(401);
  });

  it("admin : aucune restriction d'établissement", async () => {
    mockRequireRole.mockResolvedValue(session("admin"));
    expect((await GET()).status).toBe(200);
    const { creees, aggravees } = requetes();
    expect(creees.where.etudiant).toBeUndefined();
    expect(aggravees.where.etudiant).toBeUndefined();
    expect(creees.where.statut).toBe("active");
  });

  it.each(["directeur", "enseignant"])("%s : restreint à son établissement (créations et aggravations)", async (role) => {
    mockRequireRole.mockResolvedValue(session(role, "etab-42"));
    await GET();
    const { creees, aggravees } = requetes();
    expect(creees.where.etudiant).toEqual({ etablissementId: "etab-42" });
    expect(aggravees.where.etudiant).toEqual({ etablissementId: "etab-42" });
  });

  it.each(["directeur", "enseignant"])("%s sans établissement : liste vide, aucune requête", async (role) => {
    mockRequireRole.mockResolvedValue(session(role, null));
    const res = await GET();
    expect(await res.json()).toEqual({ notifications: [], vuesLe: null });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("renvoie la date de consultation enregistrée pour l'utilisateur", async () => {
    mockRequireRole.mockResolvedValue(session("admin"));
    mockUserFindUnique.mockResolvedValue({ notificationsVuesLe: new Date("2026-10-20T08:00:00.000Z") });
    const res = await GET();
    expect((await res.json()).vuesLe).toBe("2026-10-20T08:00:00.000Z");
    expect(mockUserFindUnique.mock.calls[0][0].where).toEqual({ id: "u1" });
  });

  it("renvoie 500 si la base échoue", async () => {
    mockRequireRole.mockResolvedValue(session("admin"));
    mockFindMany.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await GET()).status).toBe(500);
  });
});

// ── getNotifications ─────────────────────────────────────────────────────────

describe("getNotifications", () => {
  const maintenant = new Date("2026-10-21T10:00:00.000Z");
  const depuis = maintenant.getTime() - FENETRE_NOTIFICATIONS_MS;
  const admin = { id: "u1", role: "admin", etablissementId: null };

  it("créations et aggravations des 30 derniers jours, actives seulement, 20 au plus", async () => {
    await getNotifications(admin, maintenant);
    const { creees, aggravees } = requetes();
    expect(FENETRE_NOTIFICATIONS_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(creees.where).toMatchObject({ statut: "active" });
    expect(creees.where.createdAt.gte.getTime()).toBe(depuis);
    expect(aggravees.where).toMatchObject({ statut: "active" });
    expect(aggravees.where.niveauModifieLe.gte.getTime()).toBe(depuis);
    expect(creees.take).toBe(MAX_NOTIFICATIONS);
    expect(aggravees.orderBy).toEqual({ niveauModifieLe: "desc" });
  });

  it("une alerte créée il y a 3 jours est encore listée (plus de fenêtre de 5 minutes)", async () => {
    mockFindMany.mockResolvedValueOnce([alerteDb("a1", new Date("2026-10-18T09:00:00.000Z"))]);
    const { notifications } = await getNotifications(admin, maintenant);
    expect(notifications).toEqual([
      {
        id: "a1",
        type: "baisse_moyenne",
        niveauRisque: "eleve",
        createdAt: "2026-10-18T09:00:00.000Z",
        evenement: "creee",
        date: "2026-10-18T09:00:00.000Z",
        etudiant: { id: "etu-1", nom: "Agossou", prenom: "Koffi", niveau: "3ème" },
        etablissement: { id: "etab-1", nom: "CEG Akpakpa" },
      },
    ]);
  });

  it("aggravation d'une alerte ancienne : une seule entrée, « aggravee », datée de l'aggravation, triée en premier", async () => {
    const ancienne = alerteDb("ancienne", new Date("2026-08-01T08:00:00.000Z"), new Date("2026-10-21T09:00:00.000Z"));
    mockFindMany
      .mockResolvedValueOnce([alerteDb("recente", new Date("2026-10-20T09:00:00.000Z"))])
      .mockResolvedValueOnce([ancienne]);
    const { notifications } = await getNotifications(admin, maintenant);
    expect(notifications.map((n) => [n.id, n.evenement])).toEqual([["ancienne", "aggravee"], ["recente", "creee"]]);
    expect(notifications[0]).toMatchObject({ niveauPrecedent: "moyen", date: "2026-10-21T09:00:00.000Z" });
  });

  it("alerte créée puis aggravée dans la fenêtre : renvoyée par les deux requêtes, listée une fois", async () => {
    const a = alerteDb("a1", new Date("2026-10-19T08:00:00.000Z"), new Date("2026-10-20T08:00:00.000Z"));
    mockFindMany.mockResolvedValueOnce([a]).mockResolvedValueOnce([a]);
    const { notifications } = await getNotifications(admin, maintenant);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].evenement).toBe("aggravee");
  });

  it("aggravation antérieure à la fenêtre et création récente : c'est une création", async () => {
    mockFindMany.mockResolvedValueOnce([alerteDb("a1", new Date("2026-10-19T08:00:00.000Z"), new Date("2026-09-01T08:00:00.000Z"))]);
    const [n] = (await getNotifications(admin, maintenant)).notifications;
    expect(n.evenement).toBe("creee");
    expect(n.niveauPrecedent).toBeUndefined();
  });
});

// ── Consultation (POST) ──────────────────────────────────────────────────────

describe("POST /api/notifications/alertes — ouverture de la cloche", () => {
  it("enregistre la date du dernier événement affiché, pour l'utilisateur connecté", async () => {
    mockRequireRole.mockResolvedValue(session("enseignant", "etab-1"));
    mockUserFindUnique.mockResolvedValue({ notificationsVuesLe: new Date("2026-10-20T08:00:00.000Z") });
    const res = await post({ jusquA: "2026-10-20T08:00:00.000Z" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ vuesLe: "2026-10-20T08:00:00.000Z" });
    const { where, data } = mockUserUpdateMany.mock.calls[0][0];
    expect(where.id).toBe("u1");
    expect(data.notificationsVuesLe.toISOString()).toBe("2026-10-20T08:00:00.000Z");
  });

  it("date invalide ou absente : 400, rien n'est écrit", async () => {
    mockRequireRole.mockResolvedValue(session("admin"));
    expect((await post({ jusquA: "pas une date" })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect(mockUserUpdateMany).not.toHaveBeenCalled();
  });

  it("étudiant : 403, rien n'est écrit", async () => {
    mockRequireRole.mockResolvedValue(Response.json({ error: "Acces interdit" }, { status: 403 }));
    expect((await post({ jusquA: "2026-10-20T08:00:00.000Z" })).status).toBe(403);
    expect(mockUserUpdateMany).not.toHaveBeenCalled();
  });
});

describe("marquerNotificationsVues", () => {
  const maintenant = new Date("2026-10-21T10:00:00.000Z");

  it("jamais en arrière : la mise à jour ne touche qu'une date absente ou plus ancienne (autre appareil)", async () => {
    await marquerNotificationsVues("u1", new Date("2026-10-20T08:00:00.000Z"), maintenant);
    const { where } = mockUserUpdateMany.mock.calls[0][0];
    expect(where.OR).toEqual([
      { notificationsVuesLe: null },
      { notificationsVuesLe: { lt: new Date("2026-10-20T08:00:00.000Z") } },
    ]);
  });

  it("jamais dans le futur : une date à venir est ramenée à maintenant", async () => {
    await marquerNotificationsVues("u1", new Date("2030-01-01T00:00:00.000Z"), maintenant);
    expect(mockUserUpdateMany.mock.calls[0][0].data.notificationsVuesLe).toEqual(maintenant);
  });
});

// ── Lu / non lu ──────────────────────────────────────────────────────────────

describe("lu / non lu", () => {
  const liste = [notif("b", "2026-10-21T09:05:00.000Z"), notif("a", "2026-10-21T09:00:00.000Z")];

  it("tout est non lu si la cloche n'a jamais été ouverte", () => {
    expect(compterNonLues(liste, null)).toBe(2);
  });

  it("ne compte que les événements postérieurs à la dernière consultation", () => {
    expect(compterNonLues(liste, "2026-10-21T09:02:00.000Z")).toBe(1);
    expect(compterNonLues(liste, "2026-10-21T09:05:00.000Z")).toBe(0);
  });

  it("création lue puis aggravation : l'aggravation (plus récente) redevient non lue", () => {
    const lue = "2026-10-21T09:10:00.000Z";
    expect(estNonLue(notif("a", "2026-10-21T09:00:00.000Z"), lue)).toBe(false);
    expect(estNonLue(notif("a", "2026-10-21T09:20:00.000Z", "aggravee"), lue)).toBe(true);
  });
});
