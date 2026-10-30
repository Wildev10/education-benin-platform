import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Assistant : périmètre de chaque requête, champs renvoyés, référentiel envoyé
// à Gemini et coupure complète de l'appel par ASSISTANT_SANS_IA.

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth-guard", () => ({ requireRole: mockRequireRole }));

const mockGenerateContent = vi.fn();
const mockConstructeurGemini = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
    constructor(options: unknown) {
      mockConstructeurGemini(options);
    }
  },
  Type: { OBJECT: "OBJECT", STRING: "STRING" },
}));

const prismaMock = {
  etablissement: { findMany: vi.fn() },
  etudiant: { findMany: vi.fn() },
  absence: { findMany: vi.fn() },
  alerte: { findMany: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// Import AFTER mocks are set up
const { POST } = await import("@/app/api/assistant/route");

// ── Données ──────────────────────────────────────────────────────────────────

const MON_ETAB = "etab-notre-dame";

function user(role: string, etablissementId: string | null = null) {
  return { user: { id: "u1", role, etablissementId, etudiantId: null } };
}

const ADMIN = user("admin");
const ENSEIGNANT = user("enseignant", MON_ETAB);
const DIRECTEUR = user("directeur", MON_ETAB);
const ENSEIGNANT_SANS_ETAB = user("enseignant", null);

function question(texte: string) {
  return POST(
    new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: texte }),
    })
  );
}

/** Réponse de Gemini : le filtre JSON qu'il aurait produit. */
function geminiRepond(filtre: unknown) {
  mockGenerateContent.mockResolvedValue({ text: JSON.stringify(filtre) });
}

const ELEVE = { id: "e1", nom: "Houngbédji", prenom: "Afi", niveau: "3ème", etablissement: { nom: "CEG Notre-Dame", departement: "Littoral" } };

beforeEach(() => {
  for (const modele of Object.values(prismaMock)) {
    for (const fn of Object.values(modele)) fn.mockReset();
  }
  mockRequireRole.mockReset();
  mockGenerateContent.mockReset();
  mockConstructeurGemini.mockReset();
  vi.stubEnv("GEMINI_API_KEY", "cle-de-test");
  vi.stubEnv("ASSISTANT_SANS_IA", "");
  prismaMock.etablissement.findMany.mockResolvedValue([{ nom: "CEG Notre-Dame", departement: "Littoral", commune: "Cotonou" }]);
  prismaMock.etudiant.findMany.mockResolvedValue([]);
  prismaMock.absence.findMany.mockResolvedValue([]);
  prismaMock.alerte.findMany.mockResolvedValue([]);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// L'appel de findMany qui charge les élèves (et non les niveaux du référentiel).
const requeteEleves = () =>
  prismaMock.etudiant.findMany.mock.calls.map((c) => c[0]).find((arg) => arg.select?.nom);

// ── Périmètre ────────────────────────────────────────────────────────────────

describe("POST /api/assistant : périmètre", () => {
  it("enseignant : la recherche d'élèves est bornée à son établissement", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT);
    geminiRepond({ type: "etudiants", filtres: {}, regrouperPar: "etablissement" });
    await question("Répartition des étudiants par établissement");
    expect(requeteEleves().where).toMatchObject({ etablissementId: MON_ETAB });
  });

  it("directeur : absences et alertes bornées à son établissement", async () => {
    mockRequireRole.mockResolvedValue(DIRECTEUR);
    geminiRepond({ type: "absences", filtres: { motifAbsence: "injustifiee" } });
    await question("Combien d'absences injustifiées ?");
    expect(prismaMock.absence.findMany.mock.calls[0][0].where.etudiant).toMatchObject({ etablissementId: MON_ETAB });

    geminiRepond({ type: "alertes", filtres: {} });
    await question("Liste les alertes");
    expect(prismaMock.alerte.findMany.mock.calls[0][0].where.etudiant).toMatchObject({ etablissementId: MON_ETAB });
  });

  it("enseignant sans établissement : aucune requête d'élèves, 0 résultat", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT_SANS_ETAB);
    geminiRepond({ type: "etudiants", filtres: {} });
    const corps = await (await question("Combien d'étudiants ?")).json();
    expect(prismaMock.etudiant.findMany).not.toHaveBeenCalled();
    expect(prismaMock.etablissement.findMany).not.toHaveBeenCalled();
    expect(corps.nombreResultats).toBe(0);
  });

  it("admin : aucune restriction d'établissement", async () => {
    mockRequireRole.mockResolvedValue(ADMIN);
    geminiRepond({ type: "etudiants", filtres: {} });
    await question("Combien d'étudiants ?");
    expect(requeteEleves().where).not.toHaveProperty("etablissementId");
    expect(prismaMock.etablissement.findMany.mock.calls[0][0]).not.toHaveProperty("where");
  });

  it("enseignant : le référentiel (et la consigne Gemini) ne contient que son établissement", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT);
    geminiRepond({ type: "etudiants", filtres: {} });
    await question("Combien d'étudiants ?");
    expect(prismaMock.etablissement.findMany.mock.calls[0][0].where).toEqual({ id: MON_ETAB });
    const niveaux = prismaMock.etudiant.findMany.mock.calls.map((c) => c[0]).find((arg) => arg.distinct);
    expect(niveaux.where).toEqual({ etablissementId: MON_ETAB });
  });
});

// ── Données renvoyées ────────────────────────────────────────────────────────

describe("POST /api/assistant : champs renvoyés", () => {
  it("élèves : select minimal, sans date de naissance ni sexe", async () => {
    mockRequireRole.mockResolvedValue(ENSEIGNANT);
    geminiRepond({ type: "etudiants", filtres: {} });
    prismaMock.etudiant.findMany.mockImplementation(async (arg) => (arg.distinct ? [{ niveau: "3ème" }] : [ELEVE]));
    const corps = await (await question("Liste des étudiants")).json();
    const select = requeteEleves().select;
    expect(select).not.toHaveProperty("dateNaissance");
    expect(select).not.toHaveProperty("sexe");
    expect(requeteEleves()).not.toHaveProperty("include");
    expect(corps.donnees).toEqual([ELEVE]);
  });

  it("absences et alertes : l'élève joint n'expose que nom, prénom, niveau et établissement", async () => {
    mockRequireRole.mockResolvedValue(ADMIN);
    geminiRepond({ type: "alertes", filtres: {} });
    await question("Liste les alertes");
    const selection = prismaMock.alerte.findMany.mock.calls[0][0].select.etudiant.select;
    expect(Object.keys(selection).sort()).toEqual(["etablissement", "niveau", "nom", "prenom"]);
    expect(selection.etablissement).toEqual({ select: { nom: true, departement: true } });
  });
});

// ── ASSISTANT_SANS_IA ────────────────────────────────────────────────────────

describe("ASSISTANT_SANS_IA", () => {
  it("absente : Gemini est appelé (comportement par défaut)", async () => {
    mockRequireRole.mockResolvedValue(ADMIN);
    geminiRepond({ type: "etudiants", filtres: {} });
    const corps = await (await question("Combien d'étudiants ?")).json();
    expect(mockGenerateContent).toHaveBeenCalled();
    expect(corps.mode).toBe("ia");
  });

  it("\"true\" : aucun appel à Gemini, réponse du mode local sans mention de panne", async () => {
    vi.stubEnv("ASSISTANT_SANS_IA", "true");
    mockRequireRole.mockResolvedValue(ENSEIGNANT);
    const corps = await (await question("Combien d'étudiants ?")).json();
    expect(mockConstructeurGemini).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(corps.mode).toBe("sans_ia");
    expect(corps.reponse).toContain("(Calculé sans IA.)");
    expect(corps.reponse).not.toContain("temporairement indisponible");
    expect(requeteEleves().where).toMatchObject({ etablissementId: MON_ETAB });
  });

  it("\"true\" et question non comprise : message simple, pas « indisponible »", async () => {
    vi.stubEnv("ASSISTANT_SANS_IA", "TRUE");
    mockRequireRole.mockResolvedValue(ADMIN);
    const corps = await (await question("Quel temps fait-il ?")).json();
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(corps.mode).toBe("sans_ia");
    expect(corps.reponse).toMatch(/^Je n'ai pas compris votre question/);
  });

  it("mode local : « alertes clôturées » (ou résolues) et « alertes ouvertes » selon le statut de suivi", async () => {
    vi.stubEnv("ASSISTANT_SANS_IA", "true");
    mockRequireRole.mockResolvedValue(ADMIN);
    const resolues = await (await question("Liste les alertes clôturées")).json();
    expect(prismaMock.alerte.findMany.mock.calls[0][0].where.statut).toBe("traitee");
    expect(resolues.reponse).toMatch(/^Aucune alerte clôturée/);
    await question("Combien d'alertes ouvertes ?");
    expect(prismaMock.alerte.findMany.mock.calls[1][0].where.statut).toBe("active");
  });

  it("autre valeur (\"1\", \"false\") : Gemini reste appelé", async () => {
    mockRequireRole.mockResolvedValue(ADMIN);
    geminiRepond({ type: "etudiants", filtres: {} });
    for (const valeur of ["1", "false"]) {
      vi.stubEnv("ASSISTANT_SANS_IA", valeur);
      mockGenerateContent.mockClear();
      await question("Combien d'étudiants ?");
      expect(mockGenerateContent).toHaveBeenCalled();
    }
  });

  it("Gemini en panne (quota) : mode local avec mention « temporairement indisponible »", async () => {
    mockRequireRole.mockResolvedValue(ADMIN);
    mockGenerateContent.mockRejectedValue(Object.assign(new Error("quota"), { status: 429 }));
    const corps = await (await question("Combien d'étudiants ?")).json();
    expect(corps.mode).toBe("sans_ia");
    expect(corps.reponse).toContain("temporairement indisponible");
  });
});
