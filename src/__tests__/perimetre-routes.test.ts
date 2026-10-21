import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests de forçage d'identifiant : un utilisateur passe dans l'URL ou le corps
// l'identifiant d'une ressource qui n'est pas dans son périmètre.

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth-guard", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/detection-alerte", () => ({
  detecterAlerte: vi.fn().mockResolvedValue(null),
  detecterAlerteAbsence: vi.fn().mockResolvedValue(null),
  alerteSaisie: () => null,
}));

const mockRenderToBuffer = vi.fn();
vi.mock("@react-pdf/renderer", async (orig) => ({
  ...(await orig<typeof import("@react-pdf/renderer")>()),
  renderToBuffer: mockRenderToBuffer,
}));
vi.mock("@/lib/pdf/fiche-etudiant", () => ({ FicheEtudiantPdf: vi.fn(() => null) }));

const prismaMock = {
  alerte: { findUnique: vi.fn(), update: vi.fn() },
  absence: { findUnique: vi.fn(), delete: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  note: { findMany: vi.fn(), create: vi.fn() },
  inscription: { findMany: vi.fn() },
  etudiant: { findUnique: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// Import AFTER mocks are set up
const alertesId = await import("@/app/api/alertes/[id]/route");
const absencesId = await import("@/app/api/absences/[id]/route");
const absences = await import("@/app/api/absences/route");
const notes = await import("@/app/api/notes/route");
const inscriptions = await import("@/app/api/inscriptions/route");
const etudiantsId = await import("@/app/api/etudiants/[id]/route");
const etudiantsPdf = await import("@/app/api/etudiants/[id]/pdf/route");

// ── Données ──────────────────────────────────────────────────────────────────

const MON_ETAB = "etab-notre-dame";
const AUTRE_ETAB = "etab-mathieu-bouke";

const ELEVE_A_MOI = { id: "eleve-a-moi", nom: "Hane", prenom: "Katlyn", etablissementId: MON_ETAB };
const ELEVE_AUTRE = { id: "eleve-autre", nom: "Rau", prenom: "Elwin", etablissementId: AUTRE_ETAB };

function user(role: string, etablissementId: string | null = null, etudiantId: string | null = null) {
  return { user: { id: "u1", role, etablissementId, etudiantId } };
}

const ADMIN = user("admin");
const ENSEIGNANT = user("enseignant", MON_ETAB);
const ENSEIGNANT_SANS_ETAB = user("enseignant", null);
const DIRECTEUR = user("directeur", MON_ETAB);
const DIRECTEUR_SANS_ETAB = user("directeur", null);
const ETUDIANT = user("etudiant", null, ELEVE_A_MOI.id);

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function json(url: string, method: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  for (const modele of Object.values(prismaMock)) {
    for (const fn of Object.values(modele)) fn.mockReset();
  }
  mockRequireRole.mockReset();
  mockRenderToBuffer.mockReset().mockResolvedValue(Buffer.from("%PDF"));
  prismaMock.absence.findMany.mockResolvedValue([]);
  prismaMock.note.findMany.mockResolvedValue([]);
  prismaMock.inscription.findMany.mockResolvedValue([]);
});

// ── PATCH /api/alertes/[id] ──────────────────────────────────────────────────

describe("PATCH /api/alertes/[id]", () => {
  function alerte(etudiant: typeof ELEVE_A_MOI) {
    return { id: `alerte-${etudiant.id}`, etudiantId: etudiant.id, statut: "active", etudiant };
  }
  const traiter = (id: string) =>
    alertesId.PATCH(json(`/api/alertes/${id}`, "PATCH", { statut: "traitee" }), ctx(id));

  beforeEach(() => {
    prismaMock.alerte.update.mockImplementation(({ where }) => Promise.resolve({ id: where.id, statut: "traitee" }));
  });

  it("enseignant : forcer l'id d'une alerte d'un autre établissement → 404, rien n'est modifié", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT);
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(ELEVE_AUTRE));
    const res = await traiter("alerte-eleve-autre");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Alerte introuvable" });
    expect(prismaMock.alerte.update).not.toHaveBeenCalled();
  });

  it("hors périmètre et inexistante donnent exactement la même réponse", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT);
    prismaMock.alerte.findUnique.mockResolvedValue(null);
    const inexistante = await traiter("n-existe-pas");
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(ELEVE_AUTRE));
    const horsPerimetre = await traiter("alerte-eleve-autre");
    expect([inexistante.status, await inexistante.json()]).toEqual([horsPerimetre.status, await horsPerimetre.json()]);
  });

  it("enseignant sans établissement : ne peut traiter aucune alerte", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT_SANS_ETAB);
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(ELEVE_A_MOI));
    expect((await traiter("alerte-eleve-a-moi")).status).toBe(404);
    expect(prismaMock.alerte.update).not.toHaveBeenCalled();
  });

  it("enseignant : traite une alerte de son établissement", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT);
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(ELEVE_A_MOI));
    expect((await traiter("alerte-eleve-a-moi")).status).toBe(200);
    expect(prismaMock.alerte.update).toHaveBeenCalledOnce();
  });

  it("admin : traite toutes les alertes", async () => {
    mockRequireRole.mockResolvedValue(ADMIN);
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(ELEVE_AUTRE));
    expect((await traiter("alerte-eleve-autre")).status).toBe(200);
  });

  it("directeur : toujours refusé (rôle non autorisé)", async () => {
    mockRequireRole.mockResolvedValue(Response.json({ error: "Acces interdit" }, { status: 403 }));
    expect((await traiter("alerte-eleve-a-moi")).status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["admin", "enseignant"]);
  });
});

// ── DELETE /api/absences/[id] ────────────────────────────────────────────────

describe("DELETE /api/absences/[id]", () => {
  const supprimer = (id: string) => absencesId.DELETE(json(`/api/absences/${id}`, "DELETE"), ctx(id));

  it("enseignant : forcer l'id d'une absence d'un autre établissement → 404, rien n'est supprimé", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT);
    prismaMock.absence.findUnique.mockResolvedValue({ etudiantId: ELEVE_AUTRE.id, etudiant: ELEVE_AUTRE });
    expect((await supprimer("absence-autre")).status).toBe(404);
    expect(prismaMock.absence.delete).not.toHaveBeenCalled();
  });

  it("enseignant sans établissement → 404", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT_SANS_ETAB);
    prismaMock.absence.findUnique.mockResolvedValue({ etudiantId: ELEVE_A_MOI.id, etudiant: ELEVE_A_MOI });
    expect((await supprimer("absence-a-moi")).status).toBe(404);
  });

  it("enseignant : supprime une absence de son établissement", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT);
    prismaMock.absence.findUnique.mockResolvedValue({ etudiantId: ELEVE_A_MOI.id, etudiant: ELEVE_A_MOI });
    expect((await supprimer("absence-a-moi")).status).toBe(204);
    expect(prismaMock.absence.delete).toHaveBeenCalledOnce();
  });
});

// ── GET/POST /api/absences ───────────────────────────────────────────────────

describe("/api/absences", () => {
  it("GET : directeur avec ?etudiantId= d'un autre établissement → requête bornée à son établissement", async () => {
    mockRequireRole.mockResolvedValue(DIRECTEUR);
    await absences.GET(json(`/api/absences?etudiantId=${ELEVE_AUTRE.id}`, "GET"));
    expect(prismaMock.absence.findMany.mock.calls[0][0].where).toMatchObject({
      etudiantId: ELEVE_AUTRE.id,
      etudiant: { etablissementId: MON_ETAB },
    });
  });

  it.each([["directeur", DIRECTEUR_SANS_ETAB], ["enseignant", ENSEIGNANT_SANS_ETAB]])(
    "GET : %s sans établissement → liste vide (et non toutes les absences)",
    async (_r, session) => {
      mockRequireRole.mockResolvedValue(session);
      const res = await absences.GET(json("/api/absences", "GET"));
      expect(await res.json()).toEqual([]);
      expect(prismaMock.absence.findMany).not.toHaveBeenCalled();
    }
  );

  it("POST : absence pour un élève d'un autre établissement → 404", async () => {
    mockRequireRole.mockResolvedValue(DIRECTEUR);
    prismaMock.etudiant.findUnique.mockResolvedValue(ELEVE_AUTRE);
    const res = await absences.POST(
      json("/api/absences", "POST", {
        etudiantId: ELEVE_AUTRE.id,
        date: "2026-10-01",
        motif: "injustifiee",
        periode: "Trimestre 1",
        anneeScolaire: "2025-2026",
      })
    );
    expect(res.status).toBe(404);
    expect(prismaMock.absence.create).not.toHaveBeenCalled();
  });
});

// ── GET/POST /api/notes ──────────────────────────────────────────────────────

describe("/api/notes", () => {
  it("GET : enseignant avec ?etudiantId= d'un autre établissement → requête bornée à son établissement", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT);
    await notes.GET(json(`/api/notes?etudiantId=${ELEVE_AUTRE.id}`, "GET"));
    expect(prismaMock.note.findMany.mock.calls[0][0].where).toMatchObject({
      etudiantId: ELEVE_AUTRE.id,
      etudiant: { etablissementId: MON_ETAB },
    });
  });

  it("GET : étudiant avec ?etudiantId= d'un autre → ne reçoit que ses notes", async () => {
    mockRequireRole.mockResolvedValue(ETUDIANT);
    await notes.GET(json(`/api/notes?etudiantId=${ELEVE_AUTRE.id}`, "GET"));
    const where = prismaMock.note.findMany.mock.calls[0][0].where;
    expect(where.etudiantId).toBe(ELEVE_A_MOI.id);
    expect(where.etudiant).toEqual({ id: ELEVE_A_MOI.id });
  });

  it("GET : directeur sans établissement → liste vide (et non toutes les notes)", async () => {
    mockRequireRole.mockResolvedValue(DIRECTEUR_SANS_ETAB);
    const res = await notes.GET(json("/api/notes", "GET"));
    expect(await res.json()).toEqual([]);
    expect(prismaMock.note.findMany).not.toHaveBeenCalled();
  });

  it("POST : note pour un élève d'un autre établissement → 404", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT);
    prismaMock.etudiant.findUnique.mockResolvedValue(ELEVE_AUTRE);
    const res = await notes.POST(
      json("/api/notes", "POST", {
        etudiantId: ELEVE_AUTRE.id,
        matiere: "Mathématiques",
        valeur: 12,
        periode: "Trimestre 1",
        anneeScolaire: "2025-2026",
      })
    );
    expect(res.status).toBe(404);
    expect(prismaMock.note.create).not.toHaveBeenCalled();
  });
});

// ── GET /api/inscriptions ────────────────────────────────────────────────────

describe("GET /api/inscriptions", () => {
  it("enseignant avec ?etudiantId= d'un autre établissement → requête bornée à son établissement", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT);
    await inscriptions.GET(json(`/api/inscriptions?etudiantId=${ELEVE_AUTRE.id}`, "GET"));
    expect(prismaMock.inscription.findMany.mock.calls[0][0].where).toEqual({
      etudiantId: ELEVE_AUTRE.id,
      etudiant: { etablissementId: MON_ETAB },
    });
  });

  it("enseignant sans établissement → liste vide", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT_SANS_ETAB);
    const res = await inscriptions.GET(json("/api/inscriptions", "GET"));
    expect(await res.json()).toEqual([]);
    expect(prismaMock.inscription.findMany).not.toHaveBeenCalled();
  });

  it("admin : aucune restriction", async () => {
    mockRequireRole.mockResolvedValue(ADMIN);
    await inscriptions.GET(json(`/api/inscriptions?etudiantId=${ELEVE_AUTRE.id}`, "GET"));
    expect(prismaMock.inscription.findMany.mock.calls[0][0].where).toEqual({
      etudiantId: ELEVE_AUTRE.id,
      etudiant: {},
    });
  });
});

// ── GET /api/etudiants/[id] ──────────────────────────────────────────────────

describe("GET /api/etudiants/[id]", () => {
  const lire = (id: string) => etudiantsId.GET(json(`/api/etudiants/${id}`, "GET"), ctx(id));

  it.each([
    ["enseignant", ENSEIGNANT],
    ["directeur", DIRECTEUR],
    ["directeur sans établissement", DIRECTEUR_SANS_ETAB],
  ])("%s : fiche d'un élève d'un autre établissement → 404", async (_r, session) => {
    mockRequireRole.mockResolvedValue(session);
    prismaMock.etudiant.findUnique.mockResolvedValue(ELEVE_AUTRE);
    const res = await lire(ELEVE_AUTRE.id);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Étudiant introuvable" });
  });

  it("étudiant : fiche d'un autre élève → 404", async () => {
    mockRequireRole.mockResolvedValue(ETUDIANT);
    prismaMock.etudiant.findUnique.mockResolvedValue(ELEVE_AUTRE);
    expect((await lire(ELEVE_AUTRE.id)).status).toBe(404);
  });

  it("étudiant : sa propre fiche → 200", async () => {
    mockRequireRole.mockResolvedValue(ETUDIANT);
    prismaMock.etudiant.findUnique.mockResolvedValue(ELEVE_A_MOI);
    expect((await lire(ELEVE_A_MOI.id)).status).toBe(200);
  });

  it("directeur : élève de son établissement → 200", async () => {
    mockRequireRole.mockResolvedValue(DIRECTEUR);
    prismaMock.etudiant.findUnique.mockResolvedValue(ELEVE_A_MOI);
    expect((await lire(ELEVE_A_MOI.id)).status).toBe(200);
  });
});

// ── GET /api/etudiants/[id]/pdf ──────────────────────────────────────────────

describe("GET /api/etudiants/[id]/pdf", () => {
  const exporter = (id: string) => etudiantsPdf.GET(json(`/api/etudiants/${id}/pdf`, "GET"), ctx(id));
  const fiche = (e: typeof ELEVE_A_MOI) => ({
    ...e,
    etablissement: { nom: "x" },
    inscriptions: [],
    notes: [],
    absences: [],
    alertes: [],
  });

  it("directeur : PDF d'un élève d'un autre établissement → 404, aucun PDF généré", async () => {
    mockRequireRole.mockResolvedValue(DIRECTEUR);
    prismaMock.etudiant.findUnique.mockResolvedValue(fiche(ELEVE_AUTRE));
    expect((await exporter(ELEVE_AUTRE.id)).status).toBe(404);
    expect(mockRenderToBuffer).not.toHaveBeenCalled();
  });

  it("enseignant : PDF d'un élève de son établissement → 200", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT);
    prismaMock.etudiant.findUnique.mockResolvedValue(fiche(ELEVE_A_MOI));
    const res = await exporter(ELEVE_A_MOI.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });
});
