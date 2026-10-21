import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ExcelJS from "exceljs";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/etudiants/e1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ExportPdfButton", () => ({ ExportPdfButton: () => null, ExportExcelButton: () => null }));

const { FUSEAU_BENIN, jourAuBenin, jourIsoAuBenin } = await import("@/lib/dates");
const { ajouterLigne } = await import("@/lib/excel/commun");
const { default: AdminStudentDetail } = await import("@/app/(fr)/(espaces)/admin/etudiants/[id]/AdminStudentDetail");
const { default: StudentDetail } = await import("@/app/(fr)/(espaces)/enseignant/etudiants/[id]/StudentDetail");

// 23 h 30 UTC le 20 octobre = 0 h 30 le 21 octobre au Bénin (UTC+1), 19 h 30 le 20 à New York
const TARD_LE_SOIR = "2026-10-20T23:30:00.000Z";
const TZ_INITIAL = process.env.TZ;

/** Rendu avec le fuseau du processus réglé comme celui d'un serveur ou d'un navigateur. */
function rendreDans(fuseau: string, rendu: () => string) {
  process.env.TZ = fuseau;
  try {
    return rendu();
  } finally {
    process.env.TZ = TZ_INITIAL;
  }
}

afterEach(() => {
  process.env.TZ = TZ_INITIAL;
});

describe("dates au Bénin", () => {
  it("le fuseau de référence est Africa/Porto-Novo", () => {
    expect(FUSEAU_BENIN).toBe("Africa/Porto-Novo");
  });

  it("jour au Bénin : 23 h 30 UTC compte pour le lendemain, quel que soit le fuseau du processus", () => {
    for (const fuseau of ["UTC", "America/New_York", "Asia/Tokyo"]) {
      rendreDans(fuseau, () => {
        expect(jourIsoAuBenin(new Date(TARD_LE_SOIR))).toBe("2026-10-21");
        expect(jourAuBenin(new Date(TARD_LE_SOIR)).toISOString()).toBe("2026-10-21T00:00:00.000Z");
        return "";
      });
    }
  });

  it("date sans heure (minuit UTC, absences et naissances) : même jour", () => {
    expect(jourIsoAuBenin(new Date("2026-10-01T00:00:00.000Z"))).toBe("2026-10-01");
  });

  it("Excel : une cellule de date reçoit le jour au Bénin, que le tableur affiche sans fuseau", () => {
    const feuille = new ExcelJS.Workbook().addWorksheet("Test");
    feuille.columns = [{ key: "date" }, { key: "texte" }];
    const ligne = ajouterLigne(feuille, { date: new Date(TARD_LE_SOIR), texte: "alerte" });
    expect((ligne.getCell("date").value as Date).toISOString()).toBe("2026-10-21T00:00:00.000Z");
    expect(ligne.getCell("texte").value).toBe("alerte");
  });
});

describe("rendu identique sur un serveur en UTC et dans un navigateur à New York", () => {
  const eleve = {
    id: "e1",
    nom: "Agossou",
    prenom: "Rita",
    dateNaissance: "2010-03-05T00:00:00.000Z",
    sexe: "F",
    niveau: "3e",
    etablissement: { nom: "CEG Test", departement: "Littoral", commune: "Cotonou" },
    notes: [],
    alertes: [
      {
        id: "a1",
        niveauRisque: "eleve",
        periode: "Trimestre 1",
        moyenneAvant: 12,
        moyenneApres: 9,
        ecartPourcent: 25,
        statut: "active",
        createdAt: TARD_LE_SOIR,
      },
    ],
    absences: [{ id: "b1", date: TARD_LE_SOIR, motif: "injustifiee", periode: "Trimestre 1", anneeScolaire: "2026-2027" }],
  };

  it("fiche élève admin (cause de l'erreur d'hydratation n° 418)", () => {
    const serveur = rendreDans("UTC", () => renderToStaticMarkup(<AdminStudentDetail student={eleve} enCours={{ anneeScolaire: "2026-2027", periode: "Trimestre 1" }} />));
    const navigateur = rendreDans("America/New_York", () => renderToStaticMarkup(<AdminStudentDetail student={eleve} enCours={{ anneeScolaire: "2026-2027", periode: "Trimestre 1" }} />));
    expect(navigateur).toBe(serveur);
    expect(serveur).toContain("21 oct. 2026");
    expect(serveur).not.toContain("20 oct. 2026");
  });

  it("fiche élève enseignant : absences et date maximale du champ", () => {
    const rendu = () =>
      renderToStaticMarkup(
        <StudentDetail etudiantId="e1" anneeScolaire="2026-2027" periodeParDefaut="Trimestre 1" initialNotes={[]} initialAbsences={[eleve.absences[0]]} peutSupprimerAbsence={false} />
      );
    const serveur = rendreDans("UTC", rendu);
    const navigateur = rendreDans("America/New_York", rendu);
    expect(navigateur).toBe(serveur);
    expect(serveur).toContain("21 octobre 2026");
  });
});
