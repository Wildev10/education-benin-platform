import ExcelJS from "exceljs";
import { dateIso, formatDateHeure } from "@/lib/pdf/commun";
import { jourAuBenin } from "@/lib/dates";

/** Format numérique à 2 décimales : Excel l'affiche avec la virgule en français. */
export const FORMAT_NOTE = "0.00";
export const FORMAT_POURCENT = '0.0" %"';
export const FORMAT_DATE = "dd/mm/yyyy";

const NOIR = "FF0A0A0A";
const ORANGE = "FFF97316";
const GRIS = "FF6B7280";

/** Couleurs des niveaux d'alerte (fond, texte), reprises de l'interface. */
const COULEURS_NIVEAU: Record<string, { fond: string; texte: string }> = {
  eleve: { fond: "FFFEE2E2", texte: "FF991B1B" },
  moyen: { fond: "FFFEF3C7", texte: "FF92400E" },
};

export const LIBELLES_NIVEAU: Record<string, string> = { eleve: "Élevé", moyen: "Moyen" };
export const LIBELLES_TYPE: Record<string, string> = { baisse_moyenne: "Notes", absences: "Absences" };
// Statut de suivi (Nouvelle, En cours de suivi, Résolue) : libelleStatut de src/lib/suivi-alertes.ts
export { libelleStatut } from "@/lib/suivi-alertes";

export type Colonne = {
  titre: string;
  cle: string;
  largeur: number;
  format?: string;
  alignement?: "left" | "right" | "center";
};

export function nouveauClasseur() {
  const classeur = new ExcelJS.Workbook();
  classeur.creator = "EduTech Bénin";
  classeur.created = new Date();
  return classeur;
}

/**
 * Crée une feuille avec l'en-tête du document (plateforme, titre,
 * établissement, date d'export, lignes d'information), puis la ligne de titres
 * de colonnes en gras, figée, avec filtre automatique.
 * Retourne la feuille, prête pour `ajouterLigne`.
 */
export function nouvelleFeuille(
  classeur: ExcelJS.Workbook,
  nom: string,
  {
    titre,
    etablissement,
    genereLe,
    informations = [],
    colonnes,
  }: {
    titre: string;
    etablissement: string;
    genereLe: Date;
    informations?: string[];
    colonnes: Colonne[];
  }
) {
  const feuille = classeur.addWorksheet(nom, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  feuille.columns = colonnes.map((c) => ({ key: c.cle, width: c.largeur }));
  const derniereColonne = colonnes.length;

  const lignesEntete: [string, Partial<ExcelJS.Font>][] = [
    ["EduTech Bénin — Plateforme de suivi scolaire", { bold: true, size: 14, color: { argb: ORANGE } }],
    [titre, { bold: true, size: 12, color: { argb: NOIR } }],
    [`Établissement : ${etablissement}`, { size: 10, color: { argb: NOIR } }],
    [`Exporté le ${formatDateHeure(genereLe)}`, { size: 10, color: { argb: GRIS } }],
    ...informations.map((i): [string, Partial<ExcelJS.Font>] => [i, { size: 10, color: { argb: GRIS } }]),
  ];
  for (const [texte, police] of lignesEntete) {
    const ligne = feuille.addRow([texte]);
    ligne.getCell(1).font = police;
    feuille.mergeCells(ligne.number, 1, ligne.number, Math.max(derniereColonne, 1));
  }
  feuille.addRow([]);

  const titres = feuille.addRow(colonnes.map((c) => c.titre));
  titres.height = 20;
  titres.eachCell((cellule, i) => {
    cellule.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cellule.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NOIR } };
    cellule.alignment = { vertical: "middle", horizontal: colonnes[i - 1].alignement ?? "left" };
  });
  feuille.views = [{ state: "frozen", ySplit: titres.number, xSplit: 0, topLeftCell: `A${titres.number + 1}` }];
  feuille.autoFilter = { from: { row: titres.number, column: 1 }, to: { row: titres.number, column: derniereColonne } };

  // Formats et alignements par colonne, appliqués aux lignes de données
  colonnes.forEach((c, i) => {
    const col = feuille.getColumn(i + 1);
    if (c.format) col.numFmt = c.format;
    if (c.alignement) col.alignment = { horizontal: c.alignement };
  });

  return feuille;
}

/** Ajoute une ligne de données ; les valeurs null deviennent des cellules vides. */
export function ajouterLigne(feuille: ExcelJS.Worksheet, valeurs: Record<string, unknown>, zebre = false) {
  // Les cellules de date (format jj/mm/aaaa) reçoivent le jour au Bénin : le
  // tableur affiche la valeur sans fuseau, une alerte de 23 h 30 UTC serait datée de la veille
  const ligne = feuille.addRow(
    Object.fromEntries(Object.entries(valeurs).map(([cle, v]) => [cle, v instanceof Date ? jourAuBenin(v) : v]))
  );
  if (zebre) {
    ligne.eachCell({ includeEmpty: false }, (c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
    });
  }
  return ligne;
}

/** Met en couleur une cellule de niveau d'alerte (Élevé en rouge, Moyen en orange). */
export function colorerNiveau(cellule: ExcelJS.Cell, niveau: string | null | undefined) {
  const couleur = niveau ? COULEURS_NIVEAU[niveau] : undefined;
  if (!couleur) return;
  cellule.fill = { type: "pattern", pattern: "solid", fgColor: { argb: couleur.fond } };
  cellule.font = { bold: true, color: { argb: couleur.texte } };
}

/** Ligne de total / synthèse en gras avec un filet au-dessus. */
export function styliserTotal(ligne: ExcelJS.Row) {
  ligne.font = { bold: true };
  ligne.eachCell({ includeEmpty: true }, (c) => {
    c.border = { top: { style: "thin", color: { argb: NOIR } } };
  });
}

export function moyenne(valeurs: number[]): number | null {
  return valeurs.length ? valeurs.reduce((s, v) => s + v, 0) / valeurs.length : null;
}

export function arrondi2(valeur: number | null): number | null {
  return valeur === null ? null : Math.round(valeur * 100) / 100;
}

export async function reponseXlsx(classeur: ExcelJS.Workbook, nomFichier: string) {
  const buffer = await classeur.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function nomFichierXlsx(prefixe: string, genereLe: Date) {
  return `${prefixe}-${dateIso(genereLe)}.xlsx`;
}
