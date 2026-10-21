import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth-guard", () => ({ requireRole: mockRequireRole }));

const prismaMock = {
  etudiant: { findUnique: vi.fn() },
  etablissement: { findUnique: vi.fn() },
  alerte: { findMany: vi.fn(), count: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// Import AFTER mocks are set up
const fiche = await import("@/app/api/etudiants/[id]/xlsx/route");
const alertes = await import("@/app/api/alertes/xlsx/route");
const eleves = await import("@/app/api/etablissements/[id]/eleves/xlsx/route");
const { lignesEleves, anneeDeReference } = await import("@/lib/excel/eleves");

// ── Données ──────────────────────────────────────────────────────────────────

const MON_ETAB = "etab-mathieu-bouke";
const AUTRE_ETAB = "etab-notre-dame";
const ELWIN = "eleve-elwin";

function user(role: string, etablissementId: string | null = null, etudiantId: string | null = null) {
  return { user: { id: "u1", role, etablissementId, etudiantId } };
}

function ficheElwin(etablissementId = MON_ETAB) {
  return {
    id: ELWIN,
    nom: "Rau",
    prenom: "Elwin",
    sexe: "M",
    dateNaissance: new Date("2009-03-14T00:00:00Z"),
    niveau: "Seconde C",
    etablissementId,
    etablissement: { nom: "Lycée Mathieu Bouké", departement: "Atlantique", commune: "Cotonou" },
    inscriptions: [{ anneeScolaire: "2025-2026" }],
    notes: [
      { matiere: "Mathématiques", valeur: 12, periode: "Trimestre 1", anneeScolaire: "2025-2026" },
      { matiere: "Mathématiques", valeur: 13, periode: "Trimestre 1", anneeScolaire: "2025-2026" },
      { matiere: "Mathématiques", valeur: 8.335, periode: "Trimestre 2", anneeScolaire: "2025-2026" },
      { matiere: "Français", valeur: 15, periode: "Trimestre 1", anneeScolaire: "2025-2026" },
      { matiere: "Français", valeur: 4, periode: "Trimestre 1", anneeScolaire: "2024-2025" }, // autre année : exclue
    ],
    absences: [
      { date: new Date("2026-10-01T00:00:00Z"), motif: "injustifiee", periode: "Trimestre 1", anneeScolaire: "2025-2026" },
      { date: new Date("2026-10-08T00:00:00Z"), motif: "justifiee", periode: "Trimestre 1", anneeScolaire: "2025-2026" },
    ],
    alertes: [
      {
        type: "baisse_moyenne", niveauRisque: "eleve", statut: "active", periode: "Trimestre 2", anneeScolaire: "2025-2026",
        moyenneAvant: 13.5, moyenneApres: 8.335, ecartPourcent: 38.26, createdAt: new Date("2026-10-03T10:00:00Z"),
      },
      {
        type: "absences", niveauRisque: "moyen", statut: "traitee", periode: "Trimestre 1",
        moyenneAvant: 0, moyenneApres: 6, ecartPourcent: 0, createdAt: new Date("2026-09-20T10:00:00Z"),
      },
    ],
  };
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const requete = (url: string) => new Request(`http://localhost${url}`);

async function lireClasseur(res: Response) {
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(await res.arrayBuffer());
  return classeur;
}

/** Ligne dont la première cellule vaut `texte`. */
function ligneCommencantPar(feuille: ExcelJS.Worksheet, texte: string) {
  let trouvee: ExcelJS.Row | undefined;
  feuille.eachRow((r) => {
    if (!trouvee && r.getCell(1).value === texte) trouvee = r;
  });
  if (!trouvee) throw new Error(`Ligne « ${texte} » introuvable`);
  return trouvee;
}

beforeEach(() => {
  mockRequireRole.mockReset();
  for (const modele of Object.values(prismaMock)) for (const fn of Object.values(modele)) fn.mockReset();
  prismaMock.alerte.findMany.mockResolvedValue([]);
  prismaMock.alerte.count.mockResolvedValue(0);
});

// ── 1. Fiche élève : périmètre ───────────────────────────────────────────────

describe("GET /api/etudiants/[id]/xlsx — périmètre", () => {
  const exporter = (id = ELWIN) => fiche.GET(requete(`/api/etudiants/${id}/xlsx`), ctx(id));

  it.each([
    ["enseignant d'un autre établissement", user("enseignant", AUTRE_ETAB)],
    ["directeur d'un autre établissement", user("directeur", AUTRE_ETAB)],
    ["enseignant sans établissement", user("enseignant", null)],
    ["étudiant demandant la fiche d'un autre", user("etudiant", null, "un-autre-eleve")],
  ])("%s → 404 (forçage d'identifiant)", async (_nom, session) => {
    mockRequireRole.mockResolvedValue(session);
    prismaMock.etudiant.findUnique.mockResolvedValue(ficheElwin());
    const res = await exporter();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Étudiant introuvable" });
  });

  it("hors périmètre et inexistant : réponses identiques", async () => {
    mockRequireRole.mockResolvedValue(user("enseignant", AUTRE_ETAB));
    prismaMock.etudiant.findUnique.mockResolvedValue(ficheElwin());
    const horsPerimetre = await exporter();
    prismaMock.etudiant.findUnique.mockResolvedValue(null);
    const inexistant = await exporter("n-existe-pas");
    expect([horsPerimetre.status, await horsPerimetre.json()]).toEqual([inexistant.status, await inexistant.json()]);
  });

  it.each([
    ["admin", user("admin")],
    ["enseignant de l'établissement", user("enseignant", MON_ETAB)],
    ["directeur de l'établissement", user("directeur", MON_ETAB)],
    ["étudiant pour sa propre fiche", user("etudiant", null, ELWIN)],
  ])("%s → fichier Excel", async (_nom, session) => {
    mockRequireRole.mockResolvedValue(session);
    prismaMock.etudiant.findUnique.mockResolvedValue(ficheElwin());
    const res = await exporter();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename="fiche-rau-elwin-\d{4}-\d{2}-\d{2}\.xlsx"$/);
  });

  it("rôles acceptés : admin, enseignant, directeur, étudiant", async () => {
    mockRequireRole.mockResolvedValue(Response.json({ error: "Non authentifie" }, { status: 401 }));
    expect((await exporter()).status).toBe(401);
    expect(mockRequireRole).toHaveBeenCalledWith(["admin", "enseignant", "directeur", "etudiant"]);
    expect(prismaMock.etudiant.findUnique).not.toHaveBeenCalled();
  });
});

// ── 1 bis. Fiche élève : contenu ─────────────────────────────────────────────

describe("Fiche élève Excel — contenu relu", () => {
  let classeur: ExcelJS.Workbook;
  beforeEach(async () => {
    mockRequireRole.mockResolvedValue(user("admin"));
    prismaMock.etudiant.findUnique.mockResolvedValue(ficheElwin());
    classeur = await lireClasseur(await fiche.GET(requete(`/api/etudiants/${ELWIN}/xlsx`), ctx(ELWIN)));
  });

  it("une feuille par section", () => {
    expect(classeur.worksheets.map((f) => f.name)).toEqual(["Identité", "Notes", "Absences", "Alertes"]);
  });

  it("en-tête : plateforme, titre, établissement, date d'export", () => {
    const f = classeur.getWorksheet("Identité")!;
    expect(f.getCell("A1").value).toBe("EduTech Bénin — Plateforme de suivi scolaire");
    expect(f.getCell("A1").font.bold).toBe(true);
    expect(f.getCell("A2").value).toBe("Fiche de suivi — Elwin Rau");
    expect(f.getCell("A3").value).toBe("Établissement : Lycée Mathieu Bouké");
    expect(String(f.getCell("A4").value)).toMatch(/^Exporté le \d{1,2} \S+ \d{4} à \d{2}h\d{2}$/);
  });

  it("ligne de titres en gras et figée, largeurs adaptées", () => {
    const f = classeur.getWorksheet("Notes")!;
    const titres = ligneCommencantPar(f, "Matière");
    expect(titres.getCell(1).font.bold).toBe(true);
    expect(f.views[0]).toMatchObject({ state: "frozen", ySplit: titres.number });
    expect(f.getColumn(1).width).toBe(22);
    expect(f.getColumn(5).width).toBe(18);
  });

  it("notes : vraies valeurs numériques, format à 2 décimales, moyennes par trimestre et par matière", () => {
    const f = classeur.getWorksheet("Notes")!;
    const maths = ligneCommencantPar(f, "Mathématiques");
    expect(maths.getCell(2).value).toBe(12.5); // T1 : (12 + 13) / 2
    expect(maths.getCell(3).value).toBe(8.34); // T2 arrondi à 2 décimales
    expect(maths.getCell(4).value).toBeNull(); // T3 sans note
    expect(typeof maths.getCell(5).value).toBe("number");
    expect(maths.getCell(2).numFmt).toBe("0.00");
    const francais = ligneCommencantPar(f, "Français");
    expect(francais.getCell(2).value).toBe(15); // la note de 2024-2025 est exclue
    const generale = ligneCommencantPar(f, "Moyenne générale");
    expect(generale.getCell(2).value).toBe(13.33); // (12 + 13 + 15) / 3
    expect(generale.font.bold).toBe(true);
  });

  it("identité : date de naissance en vraie date", () => {
    const f = classeur.getWorksheet("Identité")!;
    const ligne = ligneCommencantPar(f, "Date de naissance");
    expect(ligne.getCell(2).value).toBeInstanceOf(Date);
    expect(ligne.getCell(2).numFmt).toBe("dd/mm/yyyy");
  });

  it("absences : liste datée et totaux numériques", () => {
    const f = classeur.getWorksheet("Absences")!;
    const titres = ligneCommencantPar(f, "Date");
    expect(f.getRow(titres.number + 1).getCell(3).value).toBe("Justifiée"); // la plus récente d'abord
    expect(f.getRow(titres.number + 2).getCell(3).value).toBe("Injustifiée");
    let injustifiees: unknown;
    f.eachRow((r) => { if (r.getCell(2).value === "Injustifiées") injustifiees = r.getCell(3).value; });
    expect(injustifiees).toBe(1);
  });

  it("alertes : niveaux colorés (Élevé en rouge, Moyen en orange)", () => {
    const f = classeur.getWorksheet("Alertes")!;
    const titres = ligneCommencantPar(f, "Détectée le");
    const eleve = f.getRow(titres.number + 1);
    const moyen = f.getRow(titres.number + 2);
    expect(eleve.getCell(3).value).toBe("Élevé");
    expect(eleve.getCell(3).fill).toMatchObject({ fgColor: { argb: "FFFEE2E2" } });
    expect(moyen.getCell(3).value).toBe("Moyen");
    expect(moyen.getCell(3).fill).toMatchObject({ fgColor: { argb: "FFFEF3C7" } });
    expect(eleve.getCell(8).value).toBe(38.3); // baisse en %
    expect(moyen.getCell(9).value).toBe(6); // alerte d'absences : nombre d'absences
  });

  it("alertes : la période porte son année (l'historique couvre plusieurs années)", () => {
    const f = classeur.getWorksheet("Alertes")!;
    const titres = ligneCommencantPar(f, "Détectée le");
    const colonne = (titres.values as unknown[]).indexOf("Période");
    expect(f.getRow(titres.number + 1).getCell(colonne).value).toBe("Trimestre 2 2025-2026");
    expect(f.getRow(titres.number + 2).getCell(colonne).value).toBe("Trimestre 1"); // ancienne alerte sans année
  });
});

// ── 2. Liste des alertes ─────────────────────────────────────────────────────

describe("GET /api/alertes/xlsx", () => {
  const alerteDb = {
    id: "a1", type: "baisse_moyenne", niveauRisque: "eleve", statut: "active", periode: "Trimestre 3",
    anneeScolaire: "2025-2026", moyenneAvant: 11.15, moyenneApres: 8.5, ecartPourcent: 23.8,
    createdAt: new Date("2026-10-19T10:00:00Z"),
    etudiant: { id: "e1", nom: "Rau", prenom: "Elwin", niveau: "Seconde C", etablissement: { id: MON_ETAB, nom: "Lycée Mathieu Bouké", departement: "Atlantique" } },
  };

  it("un directeur qui force ?etablissement= reste limité au sien", async () => {
    mockRequireRole.mockResolvedValue(user("directeur", MON_ETAB));
    prismaMock.etablissement.findUnique.mockResolvedValue({ nom: "Lycée Mathieu Bouké" });
    await alertes.GET(requete(`/api/alertes/xlsx?etablissement=${AUTRE_ETAB}&statut=toutes`));
    const where = prismaMock.alerte.findMany.mock.calls[0][0].where;
    expect(where.etudiant).toEqual({ etablissementId: MON_ETAB });
    expect(JSON.stringify(where)).not.toContain(AUTRE_ETAB);
  });

  it("enseignant sans établissement : fichier vide, aucune lecture d'alertes", async () => {
    mockRequireRole.mockResolvedValue(user("enseignant", null));
    const res = await alertes.GET(requete("/api/alertes/xlsx"));
    expect(res.status).toBe(200);
    expect(prismaMock.alerte.findMany).not.toHaveBeenCalled();
  });

  it("étudiant refusé", async () => {
    mockRequireRole.mockResolvedValue(Response.json({ error: "Acces interdit" }, { status: 403 }));
    expect((await alertes.GET(requete("/api/alertes/xlsx"))).status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["admin", "enseignant", "directeur"]);
  });

  it("respecte les filtres actifs et les rappelle dans l'en-tête", async () => {
    mockRequireRole.mockResolvedValue(user("admin"));
    prismaMock.alerte.findMany.mockResolvedValue([alerteDb]);
    prismaMock.alerte.count.mockResolvedValue(1);
    prismaMock.etablissement.findUnique.mockResolvedValue({ nom: "Lycée Mathieu Bouké" });
    const res = await alertes.GET(requete(`/api/alertes/xlsx?niveau=eleve&type=notes&etablissement=${MON_ETAB}`));
    expect(prismaMock.alerte.findMany.mock.calls[0][0].where).toMatchObject({
      niveauRisque: "eleve",
      type: "baisse_moyenne",
      etudiant: { etablissementId: MON_ETAB },
    });
    expect(res.headers.get("Content-Disposition")).toMatch(/filename="alertes-\d{4}-\d{2}-\d{2}\.xlsx"/);

    const f = (await lireClasseur(res)).getWorksheet("Alertes")!;
    expect(f.getCell("A3").value).toBe("Établissement : Lycée Mathieu Bouké");
    expect(f.getCell("A5").value).toBe("Filtres : Alertes actives · Risque élevé · Type : notes · Lycée Mathieu Bouké");
    const titres = ligneCommencantPar(f, "Nom");
    const ligne = f.getRow(titres.number + 1);
    expect(ligne.getCell(1).value).toBe("Rau");
    expect(ligne.getCell(6).value).toBe("Élevé");
    expect(ligne.getCell(6).fill).toMatchObject({ fgColor: { argb: "FFFEE2E2" } });
    expect(ligne.getCell(9).value).toBe(11.15);
    expect(ligne.getCell(10).value).toBe(8.5);
    expect(ligne.getCell(10).numFmt).toBe("0.00");
    expect(f.views[0]).toMatchObject({ state: "frozen", ySplit: titres.number });
  });
});

// ── 3. Liste des élèves d'un établissement ───────────────────────────────────

describe("GET /api/etablissements/[id]/eleves/xlsx", () => {
  const exporter = (id: string) => eleves.GET(requete(`/api/etablissements/${id}/eleves/xlsx`), ctx(id));
  const etab = {
    nom: "Lycée Mathieu Bouké",
    etudiants: [
      {
        nom: "Rau", prenom: "Elwin", niveau: "Seconde C",
        notes: [
          { valeur: 12, periode: "Trimestre 1", anneeScolaire: "2025-2026" },
          { valeur: 9, periode: "Trimestre 2", anneeScolaire: "2025-2026" },
          { valeur: 2, periode: "Trimestre 1", anneeScolaire: "2024-2025" },
        ],
        absences: [{ anneeScolaire: "2025-2026" }, { anneeScolaire: "2025-2026" }, { anneeScolaire: "2024-2025" }],
        alertes: [{ niveauRisque: "moyen" }, { niveauRisque: "eleve" }],
      },
      {
        nom: "Dietrich", prenom: "Jared", niveau: "Première D",
        notes: [{ valeur: 14.256, periode: "Trimestre 3", anneeScolaire: "2025-2026" }],
        absences: [],
        alertes: [{ niveauRisque: "moyen" }],
      },
      { nom: "Mann", prenom: "Maria", niveau: "Seconde C", notes: [], absences: [], alertes: [] },
    ],
  };

  it.each([
    ["enseignant", user("enseignant", MON_ETAB)],
    ["directeur", user("directeur", MON_ETAB)],
  ])("%s qui force l'identifiant d'un autre établissement → 404, aucune lecture", async (_n, session) => {
    mockRequireRole.mockResolvedValue(session);
    const res = await exporter(AUTRE_ETAB);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Établissement introuvable" });
    expect(prismaMock.etablissement.findUnique).not.toHaveBeenCalled();
  });

  it("directeur sans établissement → 404", async () => {
    mockRequireRole.mockResolvedValue(user("directeur", null));
    expect((await exporter(MON_ETAB)).status).toBe(404);
  });

  it("établissement inexistant (admin) → même 404", async () => {
    mockRequireRole.mockResolvedValue(user("admin"));
    prismaMock.etablissement.findUnique.mockResolvedValue(null);
    const res = await exporter("n-existe-pas");
    expect([res.status, await res.json()]).toEqual([404, { error: "Établissement introuvable" }]);
  });

  it("étudiant refusé", async () => {
    mockRequireRole.mockResolvedValue(Response.json({ error: "Acces interdit" }, { status: 403 }));
    expect((await exporter(MON_ETAB)).status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["admin", "enseignant", "directeur"]);
  });

  it.each([
    ["admin, n'importe quel établissement", user("admin")],
    ["directeur, son établissement", user("directeur", MON_ETAB)],
  ])("%s → fichier relu correct", async (_n, session) => {
    mockRequireRole.mockResolvedValue(session);
    prismaMock.etablissement.findUnique.mockResolvedValue(etab);
    const res = await exporter(MON_ETAB);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toMatch(/filename="eleves-lycee-mathieu-bouke-\d{4}-\d{2}-\d{2}\.xlsx"/);

    const f = (await lireClasseur(res)).getWorksheet("Élèves")!;
    expect(f.getCell("A3").value).toBe("Établissement : Lycée Mathieu Bouké");
    expect(f.getCell("A5").value).toBe("Année scolaire 2025-2026 — moyennes sur 20");
    const titres = ligneCommencantPar(f, "Nom");
    expect(titres.values).toEqual([
      undefined, "Nom", "Prénom", "Classe", "Moyenne Trimestre 1", "Moyenne Trimestre 2", "Moyenne Trimestre 3",
      "Moyenne générale", "Absences injustifiées", "Alerte active",
    ]);
    // Tri par classe puis nom : Première D (Dietrich), puis Seconde C (Mann, Rau)
    const [l1, l2, l3] = [1, 2, 3].map((k) => f.getRow(titres.number + k));
    expect([l1.getCell(1).value, l2.getCell(1).value, l3.getCell(1).value]).toEqual(["Dietrich", "Mann", "Rau"]);
    expect(l1.getCell(6).value).toBe(14.26);
    expect(l1.getCell(6).numFmt).toBe("0.00");
    expect(l3.getCell(4).value).toBe(12);
    expect(l3.getCell(7).value).toBe(10.5);
    expect(l3.getCell(8).value).toBe(2); // absences injustifiées de l'année de référence
    expect(l3.getCell(9).value).toBe("Élevé"); // le niveau le plus grave des alertes actives
    expect(l3.getCell(9).fill).toMatchObject({ fgColor: { argb: "FFFEE2E2" } });
    expect(l1.getCell(9).fill).toMatchObject({ fgColor: { argb: "FFFEF3C7" } });
    expect(l2.getCell(9).value).toBe("Aucune");
    expect(l2.getCell(7).value).toBeNull();
  });
});

describe("lignesEleves", () => {
  it("année de référence = la plus récente ayant des notes", () => {
    expect(anneeDeReference([
      { nom: "a", prenom: "a", niveau: "x", notes: [{ valeur: 1, periode: "Trimestre 1", anneeScolaire: "2024-2025" }], absencesInjustifiees: [], alertesActives: [] },
      { nom: "b", prenom: "b", niveau: "x", notes: [{ valeur: 1, periode: "Trimestre 1", anneeScolaire: "2025-2026" }], absencesInjustifiees: [], alertesActives: [] },
    ])).toBe("2025-2026");
    expect(anneeDeReference([])).toBeNull();
  });

  it("sans note : moyennes nulles, pas d'erreur", () => {
    expect(lignesEleves([{ nom: "a", prenom: "b", niveau: "x", notes: [], absencesInjustifiees: [], alertesActives: [] }], null)[0]).toMatchObject({
      t1: null, t2: null, t3: null, generale: null, absencesInjustifiees: 0, alerte: null,
    });
  });
});
