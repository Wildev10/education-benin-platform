import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth-guard", () => ({ requireRole: mockRequireRole }));

const prismaMock = {
  alerte: { findMany: vi.fn(), count: vi.fn() },
  etablissement: { findUnique: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const mockRenderToBuffer = vi.fn();
vi.mock("@react-pdf/renderer", async (orig) => ({
  ...(await orig<typeof import("@react-pdf/renderer")>()),
  renderToBuffer: mockRenderToBuffer,
}));

const mockRapport = vi.fn((props: unknown) => props);
vi.mock("@/lib/pdf/rapport-alertes", () => ({ RapportAlertesPdf: mockRapport }));

// Import AFTER mocks are set up
const {
  construireWhereAlertes,
  decrireFiltres,
  filtresVersParams,
  lireFiltres,
  porteeAlertes,
} = await import("@/lib/filtres-alertes");
const { GET } = await import("@/app/api/alertes/route");
const { GET: GET_PDF } = await import("@/app/api/alertes/pdf/route");

// ── Helpers ──────────────────────────────────────────────────────────────────

const MON_ETAB = "etab-notre-dame";
const AUTRE_ETAB = "etab-mathieu-bouke";

function user(role: string, etablissementId: string | null = null) {
  return { id: "u1", role, etudiantId: null, etablissementId };
}

function where(query: string, role = "admin", etablissementId: string | null = null) {
  return construireWhereAlertes(
    lireFiltres(new URLSearchParams(query)),
    porteeAlertes(user(role, etablissementId))
  );
}

function requete(url: string) {
  return new Request(`http://localhost${url}`);
}

beforeEach(() => {
  mockRequireRole.mockReset();
  prismaMock.alerte.findMany.mockReset().mockResolvedValue([]);
  prismaMock.alerte.count.mockReset().mockResolvedValue(0);
  prismaMock.etablissement.findUnique.mockReset().mockResolvedValue({ nom: "Lycée Mathieu Bouké" });
  mockRenderToBuffer.mockReset().mockResolvedValue(Buffer.from("%PDF-test"));
  mockRapport.mockClear();
});

// ── Lecture de l'URL ─────────────────────────────────────────────────────────

describe("lireFiltres", () => {
  it("statut actif par défaut, aucun autre filtre", () => {
    expect(lireFiltres(new URLSearchParams(""))).toEqual({ statut: "active" });
  });

  it("ignore les valeurs inconnues ou mal formées", () => {
    const f = lireFiltres(
      new URLSearchParams("niveau=critique&type=x&statut=supprimee&du=2026-02-31&au=19/10/2026&q=%20%20")
    );
    expect(f).toEqual({ statut: "active" });
  });

  it("accepte l'ancien paramètre niveauRisque et les objets searchParams de Next", () => {
    expect(lireFiltres(new URLSearchParams("niveauRisque=eleve")).niveau).toBe("eleve");
    expect(lireFiltres({ niveau: ["moyen", "eleve"], q: " Koffi " })).toMatchObject({
      niveau: "moyen",
      q: "Koffi",
    });
  });

  it("aller-retour URL → filtres → URL sans les valeurs par défaut", () => {
    const qs = "niveau=eleve&type=absences&statut=toutes&du=2026-10-01&au=2026-10-31&etablissement=e1&q=hane";
    expect(filtresVersParams(lireFiltres(new URLSearchParams(qs))).toString()).toBe(qs);
    expect(filtresVersParams(lireFiltres(new URLSearchParams("statut=active"))).toString()).toBe("");
  });
});

// ── Combinaisons de filtres ──────────────────────────────────────────────────

describe("construireWhereAlertes — combinaisons", () => {
  it("niveau + type + statut se cumulent", () => {
    expect(where("niveau=eleve&type=notes&statut=traitee")).toEqual({
      statut: "traitee",
      niveauRisque: "eleve",
      type: "baisse_moyenne",
    });
    expect(where("niveau=moyen&type=absences")).toEqual({
      statut: "active",
      niveauRisque: "moyen",
      type: "absences",
    });
  });

  it("statut=toutes ne filtre pas sur le statut", () => {
    expect(where("statut=toutes")).toEqual({});
  });

  it("tous les filtres ensemble (admin)", () => {
    const w = where("niveau=eleve&type=notes&statut=active&du=2026-10-01&au=2026-10-31&etablissement=e1&q=hane");
    expect(w).toMatchObject({
      statut: "active",
      niveauRisque: "eleve",
      type: "baisse_moyenne",
      createdAt: { gte: expect.any(Date), lte: expect.any(Date) },
      etudiant: { etablissementId: "e1", AND: expect.any(Array) },
    });
  });
});

describe("construireWhereAlertes — période", () => {
  it("bornes incluses, en heure du Bénin (UTC+1)", () => {
    const w = where("du=2026-10-01&au=2026-10-31")!;
    const createdAt = w.createdAt as { gte: Date; lte: Date };
    expect(createdAt.gte.toISOString()).toBe("2026-09-30T23:00:00.000Z");
    expect(createdAt.lte.toISOString()).toBe("2026-10-31T22:59:59.999Z");
  });

  it("une seule borne", () => {
    expect((where("du=2026-10-01")!.createdAt as object)).toEqual({ gte: new Date("2026-09-30T23:00:00.000Z") });
    expect((where("au=2026-10-01")!.createdAt as object)).toEqual({ lte: new Date("2026-10-01T22:59:59.999Z") });
  });
});

describe("construireWhereAlertes — recherche", () => {
  it("insensible à la casse, sur le nom ou le prénom", () => {
    expect(where("q=hane")!.etudiant).toEqual({
      AND: [
        {
          OR: [
            { nom: { contains: "hane", mode: "insensitive" } },
            { prenom: { contains: "hane", mode: "insensitive" } },
          ],
        },
      ],
    });
  });

  it("plusieurs mots : chacun doit correspondre (prénom + nom)", () => {
    const and = (where("q=katlyn%20%20HANE")!.etudiant as { AND: unknown[] }).AND;
    expect(and).toHaveLength(2);
    expect(JSON.stringify(and)).toContain('"katlyn"');
    expect(JSON.stringify(and)).toContain('"HANE"');
  });
});

// ── Périmètre des rôles ──────────────────────────────────────────────────────

describe("construireWhereAlertes — périmètre", () => {
  it("l'admin peut filtrer sur n'importe quel établissement", () => {
    expect(where(`etablissement=${AUTRE_ETAB}`)!.etudiant).toEqual({ etablissementId: AUTRE_ETAB });
  });

  it.each(["directeur", "enseignant"])(
    "%s qui force un autre établissement dans l'URL reste limité au sien",
    (role) => {
      const w = where(`etablissement=${AUTRE_ETAB}&niveau=eleve`, role, MON_ETAB)!;
      expect(w.etudiant).toEqual({ etablissementId: MON_ETAB });
      expect(JSON.stringify(w)).not.toContain(AUTRE_ETAB);
    }
  );

  it("le périmètre s'ajoute à la recherche sans l'écraser", () => {
    const w = where(`q=hane&etablissement=${AUTRE_ETAB}`, "directeur", MON_ETAB)!;
    expect(w.etudiant).toMatchObject({ etablissementId: MON_ETAB, AND: expect.any(Array) });
  });

  it.each([
    ["directeur sans établissement", "directeur", null],
    ["enseignant sans établissement", "enseignant", null],
    ["étudiant", "etudiant", "x"],
  ])("%s → aucun résultat possible", (_nom, role, etab) => {
    expect(where(`etablissement=${AUTRE_ETAB}`, role, etab)).toBeNull();
  });
});

describe("construireWhereAlertes — Mes suivis", () => {
  it("enseignant ou directeur : alertes dont il est responsable, toujours dans son établissement", () => {
    expect(where("suivi=moi", "enseignant", MON_ETAB)).toMatchObject({ responsableId: "u1", etudiant: { etablissementId: MON_ETAB } });
    expect(where("suivi=moi", "directeur", MON_ETAB)).toMatchObject({ responsableId: "u1", etudiant: { etablissementId: MON_ETAB } });
  });

  it("admin (aucun suivi) ou valeur inconnue : rien, ou filtre ignoré", () => {
    expect(where("suivi=moi", "admin")).toBeNull();
    expect(where("suivi=tous", "enseignant", MON_ETAB)).not.toHaveProperty("responsableId");
  });

  it("gardé dans l'URL et rappelé dans les exports", () => {
    const filtres = lireFiltres(new URLSearchParams("suivi=moi"));
    expect(filtresVersParams(filtres).get("suivi")).toBe("moi");
    expect(decrireFiltres(filtres)).toContain("Mes suivis");
  });
});

describe("decrireFiltres", () => {
  it("résume les filtres pour le PDF", () => {
    const f = lireFiltres(new URLSearchParams("niveau=eleve&type=notes&du=2026-10-01&au=2026-10-31&q=hane"));
    expect(decrireFiltres(f, "Collège Notre-Dame")).toEqual([
      "Alertes ouvertes",
      "Risque élevé",
      "Type : notes",
      "Du 01/10/2026 au 31/10/2026",
      "Collège Notre-Dame",
      "Recherche « hane »",
    ]);
  });
});

// ── API GET /api/alertes ─────────────────────────────────────────────────────

describe("GET /api/alertes", () => {
  it("applique les filtres de l'URL côté serveur", async () => {
    mockRequireRole.mockResolvedValue({ user: user("admin") });
    const res = await GET(requete("/api/alertes?niveau=eleve&type=absences&statut=traitee&q=hane"));
    expect(res.status).toBe(200);
    expect(prismaMock.alerte.findMany.mock.calls[0][0].where).toMatchObject({
      statut: "traitee",
      niveauRisque: "eleve",
      type: "absences",
    });
  });

  it("un directeur qui trafique ?etablissement= ne voit que son établissement", async () => {
    mockRequireRole.mockResolvedValue({ user: user("directeur", MON_ETAB) });
    await GET(requete(`/api/alertes?etablissement=${AUTRE_ETAB}`));
    const w = prismaMock.alerte.findMany.mock.calls[0][0].where;
    expect(w.etudiant.etablissementId).toBe(MON_ETAB);
  });

  it("un enseignant sans établissement ne reçoit rien (et non toutes les alertes)", async () => {
    mockRequireRole.mockResolvedValue({ user: user("enseignant", null) });
    const res = await GET(requete("/api/alertes?statut=active"));
    expect(await res.json()).toEqual([]);
    expect(prismaMock.alerte.findMany).not.toHaveBeenCalled();
  });

  it("refuse les rôles non autorisés", async () => {
    mockRequireRole.mockResolvedValue(Response.json({ error: "Acces interdit" }, { status: 403 }));
    const res = await GET(requete("/api/alertes"));
    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["admin", "enseignant", "directeur"]);
  });
});

// ── Export PDF ───────────────────────────────────────────────────────────────

describe("GET /api/alertes/pdf", () => {
  function propsPdf() {
    return mockRapport.mock.calls[0][0] as { statut: string; filtres: string[] };
  }

  it("respecte les filtres actifs et les annonce dans le rapport", async () => {
    mockRequireRole.mockResolvedValue({ user: user("admin") });
    const res = await GET_PDF(
      requete(`/api/alertes/pdf?niveau=moyen&statut=toutes&du=2026-10-01&etablissement=${AUTRE_ETAB}`)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(prismaMock.alerte.findMany.mock.calls[0][0].where).toMatchObject({
      niveauRisque: "moyen",
      createdAt: { gte: new Date("2026-09-30T23:00:00.000Z") },
      etudiant: { etablissementId: AUTRE_ETAB },
    });
    expect(propsPdf().statut).toBe("toutes");
    expect(propsPdf().filtres).toEqual([
      "Tous statuts",
      "Risque moyen",
      "Depuis le 01/10/2026",
      "Lycée Mathieu Bouké",
    ]);
  });

  it("un directeur ne peut pas exporter les alertes d'un autre établissement", async () => {
    mockRequireRole.mockResolvedValue({ user: user("directeur", MON_ETAB) });
    await GET_PDF(requete(`/api/alertes/pdf?etablissement=${AUTRE_ETAB}`));
    expect(prismaMock.alerte.findMany.mock.calls[0][0].where.etudiant).toEqual({ etablissementId: MON_ETAB });
    // Le nom de l'autre établissement n'est même pas recherché pour l'en-tête
    expect(prismaMock.etablissement.findUnique).not.toHaveBeenCalled();
    expect(propsPdf().filtres).toEqual(["Alertes ouvertes"]);
  });

  it("l'étudiant est refusé", async () => {
    mockRequireRole.mockResolvedValue(Response.json({ error: "Acces interdit" }, { status: 403 }));
    expect((await GET_PDF(requete("/api/alertes/pdf"))).status).toBe(403);
    expect(mockRenderToBuffer).not.toHaveBeenCalled();
  });
});
