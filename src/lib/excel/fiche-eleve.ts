import { messageAucun, titreRecapitulatif, type AnneeExport } from "@/lib/annee-export";
import { libellePeriode } from "@/lib/notes-trimestres";
import { slugFichier } from "@/lib/pdf/commun";
import {
  FORMAT_DATE,
  FORMAT_NOTE,
  FORMAT_POURCENT,
  LIBELLES_NIVEAU,
  LIBELLES_STATUT,
  LIBELLES_TYPE,
  ajouterLigne,
  arrondi2,
  colorerNiveau,
  moyenne,
  nomFichierXlsx,
  nouveauClasseur,
  nouvelleFeuille,
  styliserTotal,
} from "./commun";

const PERIODES = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];
const ORDRE_MATIERES = ["Mathématiques", "Physique-Chimie", "SVT", "Français", "Anglais", "Histoire-Géo"];

export type DonneesFicheExcel = {
  etudiant: {
    nom: string;
    prenom: string;
    dateNaissance: Date;
    sexe: string;
    niveau: string;
    etablissement: { nom: string; departement: string; commune: string };
  };
  /** Année scolaire en cours au Bénin */
  anneeScolaire: string;
  notes: AnneeExport<{ matiere: string; valeur: number; periode: string; anneeScolaire: string }>;
  absences: AnneeExport<{ date: Date; motif: string; periode: string; anneeScolaire: string }>;
  alertes: {
    type: string;
    niveauRisque: string;
    statut: string;
    periode: string;
    /** Absente des anciennes alertes */
    anneeScolaire?: string | null;
    moyenneAvant: number;
    moyenneApres: number;
    ecartPourcent: number;
    createdAt: Date;
  }[];
  genereLe: Date;
};

/**
 * Éléments affichés dans une feuille, son année et ses lignes d'information :
 * l'année en cours, sinon « Aucune note pour l'année … pour l'instant » et le
 * récapitulatif de l'année précédente s'il existe.
 */
function contenuAnnee<T>(selection: AnneeExport<T>, type: "note" | "absence", suffixe = "") {
  if (selection.enCours.length > 0) {
    return { elements: selection.enCours, annee: selection.anneeEnCours, informations: [`Année scolaire ${selection.anneeEnCours}${suffixe}`] };
  }
  const aucun = messageAucun(type, selection.anneeEnCours);
  if (!selection.precedente) return { elements: [] as T[], annee: selection.anneeEnCours, informations: [aucun] };
  const { anneeScolaire, elements } = selection.precedente;
  return { elements, annee: anneeScolaire, informations: [aucun, `${titreRecapitulatif(anneeScolaire)}${suffixe}`] };
}

export function nomFichierFiche(d: Pick<DonneesFicheExcel, "etudiant" | "genereLe">) {
  return nomFichierXlsx(`fiche-${slugFichier(d.etudiant.nom, d.etudiant.prenom)}`, d.genereLe);
}

/** Classeur de la fiche élève : une feuille par section. */
export function classeurFicheEleve(d: DonneesFicheExcel) {
  const classeur = nouveauClasseur();
  const { etudiant, genereLe, anneeScolaire } = d;
  const nomComplet = `${etudiant.prenom} ${etudiant.nom}`;
  const entete = {
    titre: `Fiche de suivi — ${nomComplet}`,
    etablissement: etudiant.etablissement.nom,
    genereLe,
  };

  // ── Identité ───────────────────────────────────────────────────────────────
  const identite = nouvelleFeuille(classeur, "Identité", {
    ...entete,
    colonnes: [
      { titre: "Rubrique", cle: "rubrique", largeur: 26 },
      { titre: "Valeur", cle: "valeur", largeur: 40 },
    ],
  });
  const lignesIdentite: [string, unknown][] = [
    ["Nom", etudiant.nom],
    ["Prénom", etudiant.prenom],
    ["Date de naissance", etudiant.dateNaissance],
    ["Sexe", etudiant.sexe === "F" ? "Féminin" : etudiant.sexe === "M" ? "Masculin" : etudiant.sexe],
    ["Classe", etudiant.niveau],
    ["Établissement", etudiant.etablissement.nom],
    ["Département", etudiant.etablissement.departement],
    ["Commune", etudiant.etablissement.commune],
    ["Année scolaire", anneeScolaire],
  ];
  for (const [rubrique, valeur] of lignesIdentite) {
    const ligne = ajouterLigne(identite, { rubrique, valeur });
    ligne.getCell(1).font = { bold: true };
    if (valeur instanceof Date) {
      ligne.getCell(2).numFmt = FORMAT_DATE;
      ligne.getCell(2).alignment = { horizontal: "left" };
    }
  }

  // ── Notes : moyenne par matière et par trimestre ──────────────────────────
  const contenuNotes = contenuAnnee(d.notes, "note", " — moyennes sur 20");
  const notesAnnee = contenuNotes.elements;
  const notes = nouvelleFeuille(classeur, "Notes", {
    ...entete,
    informations: contenuNotes.informations,
    colonnes: [
      { titre: "Matière", cle: "matiere", largeur: 22 },
      ...PERIODES.map((p, i) => ({
        titre: libellePeriode(p, contenuNotes.annee),
        cle: `t${i + 1}`,
        largeur: 21,
        format: FORMAT_NOTE,
        alignement: "right" as const,
      })),
      { titre: "Moyenne annuelle", cle: "annuelle", largeur: 18, format: FORMAT_NOTE, alignement: "right" as const },
    ],
  });
  const matieres = [...new Set(notesAnnee.map((n) => n.matiere))].sort((a, b) => {
    const ia = ORDRE_MATIERES.indexOf(a);
    const ib = ORDRE_MATIERES.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b, "fr");
  });
  const moyennePour = (filtre: (n: (typeof notesAnnee)[number]) => boolean) =>
    arrondi2(moyenne(notesAnnee.filter(filtre).map((n) => n.valeur)));
  matieres.forEach((matiere, i) => {
    ajouterLigne(
      notes,
      {
        matiere,
        ...Object.fromEntries(PERIODES.map((p, j) => [`t${j + 1}`, moyennePour((n) => n.matiere === matiere && n.periode === p)])),
        annuelle: moyennePour((n) => n.matiere === matiere),
      },
      i % 2 === 1
    );
  });
  if (notesAnnee.length > 0) {
    const totalNotes = ajouterLigne(notes, {
      matiere: "Moyenne générale",
      ...Object.fromEntries(PERIODES.map((p, j) => [`t${j + 1}`, moyennePour((n) => n.periode === p)])),
      annuelle: moyennePour(() => true),
    });
    styliserTotal(totalNotes);
  }

  // ── Absences ──────────────────────────────────────────────────────────────
  const contenuAbsences = contenuAnnee(d.absences, "absence");
  const absencesAnnee = contenuAbsences.elements;
  const absences = nouvelleFeuille(classeur, "Absences", {
    ...entete,
    informations: contenuAbsences.informations,
    colonnes: [
      { titre: "Date", cle: "date", largeur: 14, format: FORMAT_DATE, alignement: "left" },
      { titre: "Période", cle: "periode", largeur: 22 },
      { titre: "Motif", cle: "motif", largeur: 16 },
    ],
  });
  [...absencesAnnee]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .forEach((a, i) => {
      const ligne = ajouterLigne(
        absences,
        { date: a.date, periode: libellePeriode(a.periode, a.anneeScolaire), motif: a.motif === "injustifiee" ? "Injustifiée" : "Justifiée" },
        i % 2 === 1
      );
      if (a.motif === "injustifiee") ligne.getCell("motif").font = { bold: true, color: { argb: "FF991B1B" } };
    });
  const injustifiees = absencesAnnee.filter((a) => a.motif === "injustifiee").length;
  styliserTotal(ajouterLigne(absences, { date: null, periode: `Injustifiées ${contenuAbsences.annee}`, motif: injustifiees }));
  ajouterLigne(absences, { date: null, periode: `Justifiées ${contenuAbsences.annee}`, motif: absencesAnnee.length - injustifiees }).font = { bold: true };
  ajouterLigne(absences, { date: null, periode: `Total ${contenuAbsences.annee}`, motif: absencesAnnee.length }).font = { bold: true };

  // ── Alertes ───────────────────────────────────────────────────────────────
  const alertes = nouvelleFeuille(classeur, "Alertes", {
    ...entete,
    colonnes: [
      { titre: "Détectée le", cle: "date", largeur: 14, format: FORMAT_DATE, alignement: "left" },
      { titre: "Type", cle: "type", largeur: 12 },
      { titre: "Niveau", cle: "niveau", largeur: 10 },
      { titre: "Statut", cle: "statut", largeur: 10 },
      { titre: "Période", cle: "periode", largeur: 22 },
      { titre: "Moyenne avant", cle: "avant", largeur: 15, format: FORMAT_NOTE, alignement: "right" },
      { titre: "Moyenne après", cle: "apres", largeur: 15, format: FORMAT_NOTE, alignement: "right" },
      { titre: "Baisse", cle: "baisse", largeur: 11, format: FORMAT_POURCENT, alignement: "right" },
      { titre: "Absences injustifiées", cle: "absences", largeur: 21, alignement: "right" },
    ],
  });
  [...d.alertes]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .forEach((a) => {
      const absence = a.type === "absences";
      const ligne = ajouterLigne(alertes, {
        date: a.createdAt,
        type: LIBELLES_TYPE[a.type] ?? a.type,
        niveau: LIBELLES_NIVEAU[a.niveauRisque] ?? a.niveauRisque,
        statut: LIBELLES_STATUT[a.statut] ?? a.statut,
        // L'historique couvre toutes les années : la période porte la sienne
        periode: libellePeriode(a.periode, a.anneeScolaire),
        avant: absence ? null : arrondi2(a.moyenneAvant),
        apres: absence ? null : arrondi2(a.moyenneApres),
        baisse: absence ? null : Math.round(a.ecartPourcent * 10) / 10,
        absences: absence ? a.moyenneApres : null,
      });
      colorerNiveau(ligne.getCell("niveau"), a.niveauRisque);
    });

  return classeur;
}
