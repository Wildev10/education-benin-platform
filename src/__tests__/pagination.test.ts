import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth-guard", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/detection-alerte", () => ({ detecterAlerteAbsence: vi.fn() }));

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

class Redirection extends Error {
  constructor(public url: string) {
    super(`redirect ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirection(url);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

const mockRenderToBuffer = vi.fn();
vi.mock("@react-pdf/renderer", async (orig) => ({
  ...(await orig<typeof import("@react-pdf/renderer")>()),
  renderToBuffer: mockRenderToBuffer,
}));
const mockRapportPdf = vi.fn(() => null);
vi.mock("@/lib/pdf/rapport-alertes", () => ({ RapportAlertesPdf: mockRapportPdf }));

const prismaMock = {
  etudiant: { findMany: vi.fn(), count: vi.fn() },
  alerte: { findMany: vi.fn(), count: vi.fn() },
  absence: { findMany: vi.fn(), count: vi.fn() },
  actionLog: { findMany: vi.fn(), count: vi.fn() },
  user: { findMany: vi.fn(), count: vi.fn() },
  etablissement: { findMany: vi.fn(), findUnique: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// Import AFTER mocks are set up
const pagination = await import("@/lib/pagination");
const { corrigerUrlPagination } = await import("@/lib/pagination-serveur");
const { rechercherElevesPagines } = await import("@/lib/eleves-server");
const { rechercherAlertesPaginees } = await import("@/lib/alertes-server");
const { rechercherAbsencesPaginees } = await import("@/lib/absences-server");
const { lireFiltres, porteeAlertes } = await import("@/lib/filtres-alertes");
const { lireFiltresEleves } = await import("@/lib/filtres-eleves");
const { lireFiltresAbsences } = await import("@/lib/filtres-absences");
const apiEtudiants = await import("@/app/api/etudiants/route");
const apiAlertes = await import("@/app/api/alertes/route");
const apiAbsences = await import("@/app/api/absences/route");
const apiHistorique = await import("@/app/api/admin/historique/route");
const apiUtilisateurs = await import("@/app/api/admin/utilisateurs/route");
const exportXlsx = await import("@/app/api/alertes/xlsx/route");
const exportPdf = await import("@/app/api/alertes/pdf/route");
const { default: StudentDirectory } = await import("@/app/enseignant/StudentDirectory");

const {
  lirePagination,
  bornerPage,
  nombreDePages,
  paginer,
  libellePlage,
  numerosDePages,
  urlListe,
  avecPagination,
  paginationDemandee,
} = pagination;

// ── Données ──────────────────────────────────────────────────────────────────

const MON_ETAB = "etab-notre-dame";
const AUTRE_ETAB = "etab-mathieu-bouke";

function user(role: string, etablissementId: string | null = null) {
  return { id: "u1", role, etablissementId, etudiantId: null };
}
const ADMIN = user("admin");
const DIRECTEUR = user("directeur", MON_ETAB);
const ENSEIGNANT = user("enseignant", MON_ETAB);
const ENSEIGNANT_SANS_ETAB = user("enseignant", null);

const requete = (url: string) => new Request(`http://localhost${url}`);

/** N lignes factices renvoyées par findMany, pour simuler une base de `total` éléments. */
function simulerBase(modele: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> }, total: number, fabrique: (i: number) => object) {
  modele.count.mockResolvedValue(total);
  modele.findMany.mockImplementation(async (args: { skip?: number; take?: number } = {}) => {
    const debut = args.skip ?? 0;
    const fin = args.take === undefined ? total : Math.min(total, debut + args.take);
    return Array.from({ length: Math.max(0, fin - debut) }, (_, k) => fabrique(debut + k));
  });
}

const eleve = (i: number) => ({
  id: `eleve-${i}`,
  nom: `Nom${String(i).padStart(3, "0")}`,
  prenom: "P",
  niveau: "Seconde C",
  etablissement: { id: MON_ETAB, nom: "Collège Notre-Dame" },
  _count: { alertes: i % 2 },
});

const alerte = (i: number) => ({
  id: `alerte-${i}`,
  type: "baisse_moyenne",
  niveauRisque: "eleve",
  statut: "active",
  periode: "Trimestre 1",
  anneeScolaire: "2025-2026",
  moyenneAvant: 12,
  moyenneApres: 8,
  ecartPourcent: 33.3,
  createdAt: new Date("2026-10-01T10:00:00Z"),
  etudiant: {
    id: `eleve-${i}`,
    nom: `Nom${i}`,
    prenom: "P",
    niveau: "Seconde C",
    etablissement: { id: MON_ETAB, nom: "Collège Notre-Dame", departement: "Littoral" },
  },
});

beforeEach(() => {
  mockRequireRole.mockReset();
  mockAuth.mockReset();
  mockRenderToBuffer.mockReset().mockResolvedValue(Buffer.from("%PDF"));
  mockRapportPdf.mockClear();
  for (const modele of Object.values(prismaMock)) for (const fn of Object.values(modele)) fn.mockReset();
  for (const modele of [prismaMock.etudiant, prismaMock.alerte, prismaMock.absence, prismaMock.actionLog, prismaMock.user]) {
    modele.findMany.mockResolvedValue([]);
    modele.count.mockResolvedValue(0);
  }
  prismaMock.etablissement.findMany.mockResolvedValue([]);
  prismaMock.etablissement.findUnique.mockResolvedValue(null);
});

// ── 1. Lecture et bornes ─────────────────────────────────────────────────────

describe("lirePagination — valeurs de l'URL", () => {
  it("page 1 et 20 éléments par défaut", () => {
    expect(lirePagination(new URLSearchParams())).toEqual({ page: 1, taille: 20 });
  });

  it.each([["-1"], ["0"], ["abc"], ["1.5"], [""], ["2e3"], [" "]])("page=%j → page 1", (page) => {
    expect(lirePagination(new URLSearchParams({ page })).page).toBe(1);
  });

  it("une très grande page est plafonnée (skip reste un entier 32 bits)", () => {
    const { page } = lirePagination(new URLSearchParams({ page: "99999999999999999999" }));
    expect(page).toBe(1_000_000);
    expect((page - 1) * 100).toBeLessThan(2 ** 31);
  });

  it.each([["20", 20], ["50", 50], ["100", 100], ["7", 20], ["1000", 20], ["abc", 20]])("taille=%s → %i", (taille, attendu) => {
    expect(lirePagination(new URLSearchParams({ taille })).taille).toBe(attendu);
  });

  it("accepte les searchParams d'une page Next (valeurs multiples : la première)", () => {
    expect(lirePagination({ page: ["3", "9"], taille: "50" })).toEqual({ page: 3, taille: 50 });
  });

  it("paginationDemandee : seulement si page ou taille figure dans l'URL", () => {
    expect(paginationDemandee(new URLSearchParams("statut=toutes"))).toBe(false);
    expect(paginationDemandee(new URLSearchParams("page=1"))).toBe(true);
    expect(paginationDemandee(new URLSearchParams("taille=50"))).toBe(true);
  });
});

describe("bornerPage / nombreDePages", () => {
  it.each([
    [999, 143, 20, 8],
    [-1, 143, 20, 1],
    [0, 143, 20, 1],
    [8, 143, 20, 8],
    [9, 143, 20, 8],
    [5, 0, 20, 1], // liste vide : une seule page
    [2, 100, 50, 2],
    [3, 100, 50, 2],
  ])("page %i, %i éléments, %i par page → page %i", (page, total, taille, attendu) => {
    expect(bornerPage(page, total, taille)).toBe(attendu);
  });

  it("nombre de pages : au moins 1", () => {
    expect([nombreDePages(0, 20), nombreDePages(20, 20), nombreDePages(21, 20), nombreDePages(143, 50)]).toEqual([1, 1, 2, 3]);
  });
});

describe("paginer", () => {
  it("lit la fenêtre demandée (skip/take) et compte en parallèle", async () => {
    const lire = vi.fn(async ({ skip, take }: { skip: number; take: number }) => [skip, take]);
    const r = await paginer({ page: 3, taille: 20 }, async () => 143, lire);
    expect(lire).toHaveBeenCalledExactlyOnceWith({ skip: 40, take: 20 });
    expect(r).toEqual({ elements: [40, 20], total: 143, page: 3, taille: 20, nbPages: 8 });
  });

  it("page hors limites : relit la dernière page valide", async () => {
    const lire = vi.fn(async ({ skip }: { skip: number; take: number }) => (skip < 143 ? [skip] : []));
    const r = await paginer({ page: 999, taille: 20 }, async () => 143, lire);
    expect(lire).toHaveBeenLastCalledWith({ skip: 140, take: 20 });
    expect(r).toMatchObject({ page: 8, nbPages: 8, elements: [140] });
  });

  it("liste vide : page 1, sans erreur", async () => {
    const r = await paginer({ page: 4, taille: 50 }, async () => 0, async () => []);
    expect(r).toEqual({ elements: [], total: 0, page: 1, taille: 50, nbPages: 1 });
  });
});

describe("Affichage", () => {
  it.each([
    [1, 20, 143, "1–20 sur 143"],
    [2, 20, 143, "21–40 sur 143"],
    [8, 20, 143, "141–143 sur 143"],
    [1, 50, 14, "1–14 sur 14"],
    [1, 20, 0, "0 sur 0"],
  ])("page %i × %i sur %i → « %s »", (page, taille, total, attendu) => {
    expect(libellePlage({ page, taille, total })).toBe(attendu);
  });

  it("les grands nombres sont formatés à la française", () => {
    expect(libellePlage({ page: 60, taille: 20, total: 1234 }).replace(/\s/g, " ")).toBe("1 181–1 200 sur 1 234");
  });

  it.each([
    [1, 1, [1]],
    [3, 7, [1, 2, 3, 4, 5, 6, 7]],
    [1, 12, [1, 2, 3, 4, 5, "…", 12]],
    [6, 12, [1, "…", 5, 6, 7, "…", 12]],
    [12, 12, [1, "…", 8, 9, 10, 11, 12]],
    [4, 12, [1, 2, 3, 4, 5, "…", 12]],
  ])("page %i sur %i → %j", (page, nb, attendu) => {
    expect(numerosDePages(page, nb)).toEqual(attendu);
  });
});

describe("URL : filtres, page et taille", () => {
  it("page et taille par défaut ne figurent pas dans l'URL", () => {
    expect(avecPagination(new URLSearchParams("niveau=eleve"), 1, 20).toString()).toBe("niveau=eleve");
    expect(avecPagination(new URLSearchParams("niveau=eleve"), 3, 50).toString()).toBe("niveau=eleve&page=3&taille=50");
  });

  it("un changement de filtre revient à la page 1 et garde la taille", () => {
    // urlListe sans page explicite : c'est ce que font les zones de filtres
    expect(urlListe("/admin/alertes", new URLSearchParams("type=notes&page=4"), 50)).toBe("/admin/alertes?type=notes&taille=50");
    expect(urlListe("/admin/alertes", new URLSearchParams(), 20)).toBe("/admin/alertes");
  });
});

describe("corrigerUrlPagination — page hors limites", () => {
  const corriger = (params: Record<string, string>, page: number, taille: 20 | 50 | 100 = 20) => {
    try {
      corrigerUrlPagination("/admin/etudiants", new URLSearchParams("niveau=Seconde+C"), params, { page, taille });
      return null;
    } catch (e) {
      if (e instanceof Redirection) return e.url;
      throw e;
    }
  };

  it("page=999 → redirection vers la dernière page, filtres conservés", () => {
    expect(corriger({ page: "999", niveau: "Seconde C" }, 4)).toBe("/admin/etudiants?niveau=Seconde+C&page=4");
  });

  it("page=-1 → redirection vers la page 1", () => {
    expect(corriger({ page: "-1" }, 1)).toBe("/admin/etudiants?niveau=Seconde+C");
  });

  it("taille invalide → taille par défaut", () => {
    expect(corriger({ page: "2", taille: "7" }, 2)).toBe("/admin/etudiants?niveau=Seconde+C&page=2");
  });

  it("URL déjà valide : aucune redirection", () => {
    expect(corriger({ page: "2", taille: "50" }, 2, 50)).toBeNull();
    expect(corriger({}, 1)).toBeNull();
  });
});

// ── 2. Le total respecte le périmètre ────────────────────────────────────────

describe("Périmètre appliqué avant la pagination", () => {
  it("élèves : un directeur qui force ?etablissement= ne compte que son établissement", async () => {
    simulerBase(prismaMock.etudiant, 14, eleve);
    const r = await rechercherElevesPagines(lireFiltresEleves({ etablissement: AUTRE_ETAB }), DIRECTEUR, { page: 1, taille: 20 });
    expect(prismaMock.etudiant.count.mock.calls[0][0].where).toEqual({ etablissementId: MON_ETAB });
    expect(prismaMock.etudiant.findMany.mock.calls[0][0].where).toEqual({ etablissementId: MON_ETAB });
    expect(r.total).toBe(14);
  });

  it("élèves : l'admin peut filtrer sur un établissement", async () => {
    await rechercherElevesPagines(lireFiltresEleves({ etablissement: AUTRE_ETAB }), ADMIN, { page: 1, taille: 20 });
    expect(prismaMock.etudiant.count.mock.calls[0][0].where).toEqual({ etablissementId: AUTRE_ETAB });
  });

  it("élèves : un enseignant sans établissement ne compte rien et ne lit pas la base", async () => {
    const r = await rechercherElevesPagines({}, ENSEIGNANT_SANS_ETAB, { page: 3, taille: 50 });
    expect(r).toEqual({ elements: [], total: 0, page: 1, taille: 50, nbPages: 1 });
    expect(prismaMock.etudiant.count).not.toHaveBeenCalled();
    expect(prismaMock.etudiant.findMany).not.toHaveBeenCalled();
  });

  it("alertes : un enseignant qui force ?etablissement= : total et page bornés à son établissement", async () => {
    await rechercherAlertesPaginees(lireFiltres({ etablissement: AUTRE_ETAB }), porteeAlertes(ENSEIGNANT), { page: 1, taille: 20 });
    for (const appel of [prismaMock.alerte.count.mock.calls[0][0], prismaMock.alerte.findMany.mock.calls[0][0]]) {
      expect(appel.where.etudiant).toEqual({ etablissementId: MON_ETAB });
    }
  });

  it("alertes : sans établissement → aucune requête", async () => {
    const r = await rechercherAlertesPaginees(lireFiltres({}), porteeAlertes(ENSEIGNANT_SANS_ETAB), { page: 1, taille: 20 });
    expect(r.total).toBe(0);
    expect(prismaMock.alerte.count).not.toHaveBeenCalled();
  });

  it("absences : le directeur ne compte que les absences de son établissement, même avec ?etablissement=", async () => {
    await rechercherAbsencesPaginees(lireFiltresAbsences({ etablissement: AUTRE_ETAB }), DIRECTEUR, { page: 1, taille: 20 });
    expect(prismaMock.absence.count.mock.calls[0][0].where).toEqual({ etudiant: { etablissementId: MON_ETAB } });
  });

  it("API élèves : le total renvoyé au directeur est celui de son établissement", async () => {
    mockRequireRole.mockResolvedValue({ user: DIRECTEUR });
    simulerBase(prismaMock.etudiant, 14, eleve);
    const res = await apiEtudiants.GET(requete(`/api/etudiants?page=1&etablissementId=${AUTRE_ETAB}`));
    const corps = await res.json();
    expect(corps).toMatchObject({ total: 14, page: 1, taille: 20, nbPages: 1 });
    expect(prismaMock.etudiant.count.mock.calls[0][0].where).toEqual({ etablissementId: MON_ETAB });
  });

  it("API absences paginée : un compte sans établissement reçoit une page vide sans lecture", async () => {
    mockRequireRole.mockResolvedValue({ user: ENSEIGNANT_SANS_ETAB });
    const res = await apiAbsences.GET(requete("/api/absences?page=2"));
    expect(await res.json()).toEqual({ elements: [], total: 0, page: 1, taille: 20, nbPages: 1 });
    expect(prismaMock.absence.count).not.toHaveBeenCalled();
  });
});

// ── 3. Filtres combinés à la pagination ──────────────────────────────────────

describe("Filtres combinés à la pagination", () => {
  it("alertes : niveau + type + recherche, page 2 de 50 → mêmes filtres pour le total et la page", async () => {
    simulerBase(prismaMock.alerte, 120, alerte);
    mockRequireRole.mockResolvedValue({ user: ADMIN });
    const res = await apiAlertes.GET(requete("/api/alertes?niveau=eleve&type=notes&q=rau&statut=toutes&page=2&taille=50"));
    const corps = await res.json();

    const compte = prismaMock.alerte.count.mock.calls[0][0].where;
    const lecture = prismaMock.alerte.findMany.mock.calls[0][0];
    expect(compte).toEqual(lecture.where);
    expect(compte).toMatchObject({ niveauRisque: "eleve", type: "baisse_moyenne" });
    expect(compte.statut).toBeUndefined();
    expect(compte.etudiant.AND).toHaveLength(1);
    expect(lecture).toMatchObject({ skip: 50, take: 50 });
    expect(corps).toMatchObject({ total: 120, page: 2, taille: 50, nbPages: 3 });
    expect(corps.elements).toHaveLength(50);
    expect(corps.elements[0].id).toBe("alerte-50");
  });

  it("alertes : l'ordre est stable entre les pages (id en dernier critère de tri)", async () => {
    await rechercherAlertesPaginees(lireFiltres({}), porteeAlertes(ADMIN), { page: 1, taille: 20 });
    expect(prismaMock.alerte.findMany.mock.calls[0][0].orderBy).toEqual([
      { niveauRisque: "asc" },
      { createdAt: "desc" },
      { id: "asc" },
    ]);
  });

  it("élèves : niveau + recherche sur deux mots, page 3 de 20 dans le périmètre de l'enseignant", async () => {
    simulerBase(prismaMock.etudiant, 45, eleve);
    const r = await rechercherElevesPagines(
      lireFiltresEleves({ niveau: "Seconde C", q: "elwin rau", page: "3" }),
      ENSEIGNANT,
      lirePagination({ page: "3" })
    );
    const where = prismaMock.etudiant.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ niveau: "Seconde C", etablissementId: MON_ETAB });
    expect(where.AND).toHaveLength(2);
    expect(prismaMock.etudiant.findMany.mock.calls[0][0]).toMatchObject({ skip: 40, take: 20 });
    expect(r).toMatchObject({ total: 45, page: 3, nbPages: 3 });
    expect(r.elements).toHaveLength(5);
    expect(r.elements[0]).toMatchObject({ id: "eleve-40", alerteActive: false });
    expect(r.elements[1]).toMatchObject({ id: "eleve-41", alerteActive: true });
  });

  it("élèves : un niveau inconnu est ignoré", () => {
    expect(lireFiltresEleves({ niveau: "CM2" }).niveau).toBeUndefined();
  });

  it("absences : période + motif + année, page 2 de 20", async () => {
    simulerBase(prismaMock.absence, 30, (i) => ({ id: `abs-${i}` }));
    mockRequireRole.mockResolvedValue({ user: DIRECTEUR });
    const res = await apiAbsences.GET(
      requete("/api/absences?periode=Trimestre+2&motif=injustifiee&annee=2025-2026&page=2")
    );
    const corps = await res.json();
    expect(prismaMock.absence.count.mock.calls[0][0].where).toEqual({
      periode: "Trimestre 2",
      motif: "injustifiee",
      anneeScolaire: "2025-2026",
      etudiant: { etablissementId: MON_ETAB },
    });
    expect(corps).toMatchObject({ total: 30, page: 2, nbPages: 2 });
    expect(corps.elements).toHaveLength(10);
  });

  it("historique : action + utilisateur, page hors limites ramenée à la dernière", async () => {
    simulerBase(prismaMock.actionLog, 45, (i) => ({ id: `log-${i}`, createdAt: new Date("2026-10-01T10:00:00Z"), user: {} }));
    mockRequireRole.mockResolvedValue({ user: ADMIN });
    const res = await apiHistorique.GET(requete("/api/admin/historique?action=NOTE_CREEE&userId=u7&page=999"));
    const corps = await res.json();
    expect(prismaMock.actionLog.count.mock.calls[0][0].where).toEqual({ action: "NOTE_CREEE", userId: "u7" });
    expect(corps).toMatchObject({ total: 45, page: 3, nbPages: 3 });
    expect(corps.elements).toHaveLength(5);
    expect(corps.elements[0].createdAt).toBe("2026-10-01T10:00:00.000Z");
  });

  it("utilisateurs : page=-1 → page 1", async () => {
    simulerBase(prismaMock.user, 4, (i) => ({ id: `u${i}` }));
    mockRequireRole.mockResolvedValue({ user: ADMIN });
    const corps = await (await apiUtilisateurs.GET(requete("/api/admin/utilisateurs?page=-1"))).json();
    expect(corps).toMatchObject({ total: 4, page: 1, nbPages: 1 });
    expect(prismaMock.user.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 20 });
  });
});

// ── 4. Compatibilité : sans page ni taille, les routes répondent comme avant ──

describe("Routes API sans page ni taille", () => {
  it("/api/alertes renvoie toujours la liste complète (tableau)", async () => {
    simulerBase(prismaMock.alerte, 30, alerte);
    mockRequireRole.mockResolvedValue({ user: ADMIN });
    const corps = await (await apiAlertes.GET(requete("/api/alertes"))).json();
    expect(Array.isArray(corps)).toBe(true);
    expect(corps).toHaveLength(30);
    expect(prismaMock.alerte.findMany.mock.calls[0][0].take).toBeUndefined();
  });

  it("/api/admin/utilisateurs renvoie un tableau", async () => {
    simulerBase(prismaMock.user, 4, (i) => ({ id: `u${i}` }));
    mockRequireRole.mockResolvedValue({ user: ADMIN });
    expect(await (await apiUtilisateurs.GET(requete("/api/admin/utilisateurs"))).json()).toHaveLength(4);
  });
});

// ── 5. Les exports contiennent tous les résultats filtrés ────────────────────

describe("Exports : la totalité des résultats filtrés, jamais une seule page", () => {
  beforeEach(() => {
    simulerBase(prismaMock.alerte, 57, alerte);
    mockRequireRole.mockResolvedValue({ user: DIRECTEUR });
    prismaMock.etablissement.findUnique.mockResolvedValue({ nom: "Collège Notre-Dame" });
  });

  it("Excel : page=2&taille=20 dans l'URL n'est pas appliqué, les 57 alertes y sont", async () => {
    const res = await exportXlsx.GET(requete("/api/alertes/xlsx?niveau=eleve&statut=toutes&page=2&taille=20"));
    expect(res.status).toBe(200);
    const lecture = prismaMock.alerte.findMany.mock.calls[0][0];
    expect(lecture.skip).toBeUndefined();
    expect(lecture.take).toBeUndefined();
    expect(lecture.where).toMatchObject({ niveauRisque: "eleve", etudiant: { etablissementId: MON_ETAB } });

    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(await res.arrayBuffer());
    const feuille = classeur.getWorksheet("Alertes")!;
    let lignesEleves = 0;
    feuille.eachRow((r) => {
      if (String(r.getCell(1).value ?? "").startsWith("Nom") && r.getCell(2).value === "P") lignesEleves++;
    });
    expect(lignesEleves).toBe(57);
  });

  it("PDF : page=3 dans l'URL n'est pas appliqué, le rapport reçoit les 57 alertes", async () => {
    const res = await exportPdf.GET(requete("/api/alertes/pdf?statut=toutes&page=3&taille=20"));
    expect(res.status).toBe(200);
    expect(prismaMock.alerte.findMany.mock.calls[0][0].take).toBeUndefined();
    expect(mockRapportPdf.mock.calls[0][0].alertes).toHaveLength(57);
  });
});

// ── 6. Page de la liste des élèves ───────────────────────────────────────────

describe("Liste des élèves (rendu serveur)", () => {
  async function rendre(searchParams: Record<string, string>, session = DIRECTEUR) {
    mockAuth.mockResolvedValue({ user: session });
    try {
      await StudentDirectory({ chemin: "/enseignant", searchParams });
      return null;
    } catch (e) {
      if (e instanceof Redirection) return e.url;
      throw e;
    }
  }

  it("page=999 → redirigée vers la dernière page de son établissement, filtres gardés", async () => {
    simulerBase(prismaMock.etudiant, 45, eleve);
    expect(await rendre({ page: "999", niveau: "Seconde C" })).toBe("/enseignant?niveau=Seconde+C&page=3");
  });

  it("page=-1 → redirigée vers la page 1", async () => {
    simulerBase(prismaMock.etudiant, 45, eleve);
    expect(await rendre({ page: "-1", taille: "50" })).toBe("/enseignant?taille=50");
  });

  it("un directeur ne garde pas ?etablissement= d'un autre établissement dans les liens", async () => {
    simulerBase(prismaMock.etudiant, 45, eleve);
    expect(await rendre({ page: "999", etablissement: AUTRE_ETAB })).toBe("/enseignant?page=3");
  });

  it("page valide : rendu sans redirection ni lecture de la liste des établissements", async () => {
    simulerBase(prismaMock.etudiant, 45, eleve);
    expect(await rendre({ page: "2" })).toBeNull();
    expect(prismaMock.etablissement.findMany).not.toHaveBeenCalled();
  });
});
