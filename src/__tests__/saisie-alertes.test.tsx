import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Règles de détection appliquées à la saisie (POST /api/notes, /api/absences)
// et à l'import CSV, et ce que l'enseignant voit sur la fiche.

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth-guard", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAction: vi.fn() }));

const prismaMock = {
  etudiant: { findUnique: vi.fn(), findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  note: { create: vi.fn(), findMany: vi.fn() },
  absence: { create: vi.fn(), findMany: vi.fn() },
  alerte: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { POST: postNote } = await import("@/app/api/notes/route");
const { POST: postAbsence } = await import("@/app/api/absences/route");
const { POST: postImport } = await import("@/app/api/notes/import/route");
const { default: StudentDetail } = await import("@/app/(fr)/(espaces)/enseignant/etudiants/[id]/StudentDetail");

// ── Helpers ──────────────────────────────────────────────────────────────────

const ETAB = "etab-1";
const ANNEE = "2026-2027";
const ELEVE = { id: "etu-1", etablissementId: ETAB, prenom: "Koffi", nom: "Agossou" };

const json = (url: string, corps: unknown) =>
  new Request(`http://localhost${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });

function csv(lignes: string[]) {
  const form = new FormData();
  const texte = ["email_etudiant,matiere,valeur,periode,anneeScolaire", ...lignes].join("\n");
  form.set("fichier", new File([texte], "notes.csv", { type: "text/csv" }));
  return new Request("http://localhost/api/notes/import", { method: "POST", body: form });
}

const notes = (...liste: [number, string, string?][]) =>
  liste.map(([valeur, periode, anneeScolaire = ANNEE]) => ({ valeur, periode, anneeScolaire }));

beforeEach(() => {
  for (const table of Object.values(prismaMock)) for (const fn of Object.values(table)) fn.mockReset();
  mockRequireRole.mockResolvedValue({ user: { id: "u1", role: "enseignant", etudiantId: null, etablissementId: ETAB } });
  prismaMock.etudiant.findUnique.mockResolvedValue(ELEVE);
  prismaMock.note.create.mockImplementation(({ data }) => Promise.resolve({ id: "n1", ...data }));
  prismaMock.absence.create.mockImplementation(({ data }) => Promise.resolve({ id: "abs1", ...data }));
  prismaMock.alerte.findFirst.mockResolvedValue(null);
  prismaMock.alerte.create.mockImplementation(({ data }) =>
    Promise.resolve({ id: "al-1", createdAt: new Date("2026-10-21T10:00:00.000Z"), niveauModifieLe: null, ...data })
  );
});

// ── Saisie d'une note ────────────────────────────────────────────────────────

describe("POST /api/notes : détection et réponse", () => {
  const corps = { etudiantId: "etu-1", matiere: "SVT", valeur: 3, periode: "Trimestre 1", anneeScolaire: ANNEE };

  it("baisse de 20 % et moyenne < 10 : l'alerte Élevé est renvoyée avec l'élève", async () => {
    prismaMock.note.findMany.mockResolvedValue(notes([14, "Trimestre 3", "2025-2026"], [9, "Trimestre 1"], [3, "Trimestre 1"]));
    const res = await postNote(json("/api/notes", corps));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data).toMatchObject({
      alerteCreee: true,
      etudiant: { prenom: "Koffi", nom: "Agossou" },
      alerte: { issue: "creee", type: "baisse_moyenne", niveauRisque: "eleve", periode: "Trimestre 1", anneeScolaire: ANNEE },
    });
  });

  it("une seule note dans la période en cours : enregistrée, sans alerte", async () => {
    prismaMock.note.findMany.mockResolvedValue(notes([14, "Trimestre 3", "2025-2026"], [3, "Trimestre 1"]));
    const data = await (await postNote(json("/api/notes", corps))).json();
    expect(data).toMatchObject({ alerteCreee: false, alerte: null });
    expect(prismaMock.alerte.create).not.toHaveBeenCalled();
  });
});

// ── Saisie d'une absence ─────────────────────────────────────────────────────

describe("POST /api/absences : détection et réponse", () => {
  const corps = { etudiantId: "etu-1", date: "2026-10-20", motif: "injustifiee", periode: "Trimestre 1", anneeScolaire: ANNEE };

  it("5e absence injustifiée de la période : alerte Moyen renvoyée", async () => {
    prismaMock.absence.findMany.mockResolvedValue(Array.from({ length: 5 }, () => ({ periode: "Trimestre 1", anneeScolaire: ANNEE })));
    const data = await (await postAbsence(json("/api/absences", corps))).json();
    expect(data).toMatchObject({ alerteCreee: true, alerte: { type: "absences", niveauRisque: "moyen", moyenneApres: 5 } });
  });

  it("une seule absence : enregistrée, sans alerte", async () => {
    prismaMock.absence.findMany.mockResolvedValue([{ periode: "Trimestre 1", anneeScolaire: ANNEE }]);
    const data = await (await postAbsence(json("/api/absences", corps))).json();
    expect(data).toMatchObject({ alerteCreee: false, alerte: null, etudiant: { prenom: "Koffi" } });
  });
});

// ── Import CSV ───────────────────────────────────────────────────────────────

describe("POST /api/notes/import : mêmes règles, une détection par élève après toutes ses lignes", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockImplementation(({ where }) =>
      Promise.resolve({ role: "etudiant", etudiantId: where.email === "a@x.bj" ? "etu-1" : "etu-2" })
    );
    prismaMock.etudiant.findUnique.mockResolvedValue({ etablissementId: ETAB });
    prismaMock.etudiant.findMany.mockImplementation(({ where }) =>
      Promise.resolve(
        where.id.in.map((id: string) => (id === "etu-1" ? { id, prenom: "Koffi", nom: "Agossou" } : { id, prenom: "Awa", nom: "Dossou" }))
      )
    );
  });

  it("détection lancée une fois par élève, après l'enregistrement de toutes les notes", async () => {
    prismaMock.note.findMany.mockResolvedValue([]);
    const res = await postImport(
      csv(["a@x.bj,SVT,3,Trimestre 1,2026-2027", "a@x.bj,SVT,4,Trimestre 1,2026-2027", "b@x.bj,SVT,12,Trimestre 1,2026-2027"])
    );
    expect((await res.json()).importees).toBe(3);
    expect(prismaMock.note.findMany.mock.calls.map(([arg]) => arg.where.etudiantId)).toEqual(["etu-1", "etu-2"]);
    const derniereCreation = Math.max(...prismaMock.note.create.mock.invocationCallOrder);
    expect(Math.min(...prismaMock.note.findMany.mock.invocationCallOrder)).toBeGreaterThan(derniereCreation);
  });

  it("le rapport liste les alertes avec l'élève et le niveau, calculées sur toutes les notes importées", async () => {
    // Après import : T3 2025-2026 = 14, T1 2026-2027 = (3 + 4) / 2 = 3,5 → Élevé.
    // Une détection après la 1re ligne seulement n'aurait rien vu (1 note dans la période).
    prismaMock.note.findMany.mockImplementation(({ where }) =>
      Promise.resolve(where.etudiantId === "etu-1" ? notes([14, "Trimestre 3", "2025-2026"], [3, "Trimestre 1"], [4, "Trimestre 1"]) : [])
    );
    const rapport = await (await postImport(csv(["a@x.bj,SVT,3,Trimestre 1,2026-2027", "a@x.bj,SVT,4,Trimestre 1,2026-2027"]))).json();
    expect(rapport.alertesCreees).toBe(1);
    expect(rapport.alertes).toEqual([
      expect.objectContaining({
        issue: "creee",
        niveauRisque: "eleve",
        periode: "Trimestre 1",
        etudiant: { id: "etu-1", prenom: "Koffi", nom: "Agossou" },
      }),
    ]);
  });
});

// ── Fiche élève ──────────────────────────────────────────────────────────────

describe("fiche élève : période par défaut et mention de comparaison", () => {
  const rendu = (initialNotes: { id: string; matiere: string; valeur: number; periode: string; anneeScolaire: string }[]) =>
    renderToStaticMarkup(
      <StudentDetail etudiantId="e1" anneeScolaire={ANNEE} periodeParDefaut="Trimestre 2" initialNotes={initialNotes} initialAbsences={[]} />
    );
  const n = (id: string, periode: string, anneeScolaire = ANNEE) => ({ id, matiere: "SVT", valeur: 12, periode, anneeScolaire });

  it("trimestre et année en cours proposés, plus d'année figée", () => {
    const html = rendu([]);
    expect(html).toMatch(/<select id="periode"[^>]*>.*<option selected="">Trimestre 2<\/option>/);
    expect(html).toContain(`<strong class="text-ink">${ANNEE}</strong>`);
    expect(html).not.toContain("2025-2026");
  });

  it("nouvel élève (une seule période) : « Pas encore de période de comparaison »", () => {
    expect(rendu([n("1", "Trimestre 1"), n("2", "Trimestre 1")])).toContain("Pas encore de période de comparaison pour les notes.");
  });

  it("deux périodes comparées : pas de mention", () => {
    expect(rendu([n("1", "Trimestre 1"), n("2", "Trimestre 2"), n("3", "Trimestre 2")])).not.toContain("data-comparaison");
  });
});
