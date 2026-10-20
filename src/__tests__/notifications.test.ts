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
const { fusionnerNotifications, compterNonLues, estNonLue, dateEvenement, FENETRE_NOTIFICATIONS_MS } = await import(
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

  const maintenant = new Date("2026-10-19T10:00:00.000Z");
  const depuis = maintenant.getTime() - FENETRE_NOTIFICATIONS_MS;

  it("alertes créées OU aggravées dans les 5 dernières minutes, actives seulement", async () => {
    mockFindMany.mockResolvedValue([]);
    await getAlertesRecentes(null, maintenant);
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.statut).toBe("active");
    expect(where.OR.map((c: Record<string, { gte: Date }>) => Object.keys(c)[0])).toEqual(["createdAt", "niveauModifieLe"]);
    expect(where.OR.every((c: Record<string, { gte: Date }>) => Object.values(c)[0].gte.getTime() === depuis)).toBe(true);
  });

  it("périmètre : la restriction d'établissement s'applique aux créations ET aux aggravations (hors du OR)", async () => {
    mockFindMany.mockResolvedValue([]);
    await getAlertesRecentes("etab-42", maintenant);
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.etudiant).toEqual({ etablissementId: "etab-42" });
    expect(JSON.stringify(where.OR)).not.toContain("etablissement");
  });

  it("création récente : événement « creee », daté de la création", async () => {
    mockFindMany.mockResolvedValue([alerteDb("a1", new Date("2026-10-19T09:58:00.000Z"))]);
    const res = await getAlertesRecentes(null, maintenant);
    expect(res).toEqual([
      {
        id: "a1",
        type: "baisse_moyenne",
        niveauRisque: "eleve",
        createdAt: "2026-10-19T09:58:00.000Z",
        evenement: "creee",
        date: "2026-10-19T09:58:00.000Z",
        etudiant: { id: "etu-1", nom: "Agossou", prenom: "Koffi", niveau: "3ème" },
        etablissement: { id: "etab-1", nom: "CEG Akpakpa" },
      },
    ]);
  });

  it("aggravation récente d'une alerte ancienne : événement « aggravee », Moyen → Élevé, daté de l'aggravation", async () => {
    mockFindMany.mockResolvedValue([
      { ...alerteDb("a1", new Date("2026-10-01T08:00:00.000Z")), niveauModifieLe: new Date("2026-10-19T09:59:00.000Z") },
    ]);
    const [n] = await getAlertesRecentes(null, maintenant);
    expect(n).toMatchObject({ evenement: "aggravee", niveauPrecedent: "moyen", niveauRisque: "eleve", date: "2026-10-19T09:59:00.000Z" });
  });

  it("aggravation ancienne et création récente : c'est une création (l'aggravation est hors fenêtre)", async () => {
    mockFindMany.mockResolvedValue([
      { ...alerteDb("a1", new Date("2026-10-19T09:58:00.000Z")), niveauModifieLe: new Date("2026-10-18T09:00:00.000Z") },
    ]);
    const [n] = await getAlertesRecentes(null, maintenant);
    expect(n.evenement).toBe("creee");
    expect(n.niveauPrecedent).toBeUndefined();
  });

  it("trie par date d'événement : une aggravation récente passe avant une création plus ancienne", async () => {
    mockFindMany.mockResolvedValue([
      alerteDb("creee", new Date("2026-10-19T09:57:00.000Z")),
      { ...alerteDb("aggravee", new Date("2026-10-01T08:00:00.000Z")), niveauModifieLe: new Date("2026-10-19T09:59:00.000Z") },
    ]);
    expect((await getAlertesRecentes(null, maintenant)).map((n) => n.id)).toEqual(["aggravee", "creee"]);
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

// ── Aggravations : lu / non lu ───────────────────────────────────────────────

describe("aggravation et lu / non lu", () => {
  const creee = notif("a", "2026-10-19T09:00:00.000Z");
  const aggravee: NotificationAlerte = {
    ...creee,
    niveauRisque: "eleve",
    evenement: "aggravee",
    niveauPrecedent: "moyen",
    date: "2026-10-19T09:20:00.000Z",
  };

  it("création déjà lue puis aggravation : redevient non lue", () => {
    const lue = "2026-10-19T09:10:00.000Z"; // dropdown ouvert après la création
    expect(compterNonLues([creee], lue)).toBe(0);
    const apres = fusionnerNotifications([creee], [aggravee]);
    expect(compterNonLues(apres, lue)).toBe(1);
    expect(estNonLue(apres[0], lue)).toBe(true);
  });

  it("aggravation lue : plus comptée", () => {
    expect(compterNonLues([aggravee], "2026-10-19T09:30:00.000Z")).toBe(0);
  });

  it("une seule entrée par alerte : l'aggravation remplace la création", () => {
    const res = fusionnerNotifications([creee], [aggravee]);
    expect(res).toHaveLength(1);
    expect(res[0].evenement).toBe("aggravee");
  });

  it("une ancienne réponse (création) n'écrase pas une aggravation déjà connue", () => {
    expect(fusionnerNotifications([aggravee], [creee])[0].evenement).toBe("aggravee");
  });

  it("notifications stockées avant cette version (sans date ni événement) : date de création", () => {
    expect(dateEvenement(creee)).toBe(creee.createdAt);
    expect(compterNonLues([creee], "2026-10-19T08:00:00.000Z")).toBe(1);
  });
});
