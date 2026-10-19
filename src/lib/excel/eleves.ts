import { slugFichier } from "@/lib/pdf/commun";
import {
  FORMAT_NOTE,
  LIBELLES_NIVEAU,
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

export type EleveSource = {
  nom: string;
  prenom: string;
  niveau: string;
  notes: { valeur: number; periode: string; anneeScolaire: string }[];
  absencesInjustifiees: { anneeScolaire: string }[];
  alertesActives: { niveauRisque: string }[];
};

export type LigneEleve = {
  nom: string;
  prenom: string;
  classe: string;
  t1: number | null;
  t2: number | null;
  t3: number | null;
  generale: number | null;
  absencesInjustifiees: number;
  alerte: "eleve" | "moyen" | null;
};

/** Année de référence : la plus récente ayant des notes dans l'établissement. */
export function anneeDeReference(eleves: EleveSource[]): string | null {
  const annees = [...new Set(eleves.flatMap((e) => e.notes.map((n) => n.anneeScolaire)))].sort();
  return annees.at(-1) ?? null;
}

/** Calcule une ligne par élève pour l'année de référence, triée par classe puis nom. */
export function lignesEleves(eleves: EleveSource[], annee: string | null): LigneEleve[] {
  return eleves
    .map((e) => {
      const notes = e.notes.filter((n) => n.anneeScolaire === annee);
      const moyenneT = (p: string) => arrondi2(moyenne(notes.filter((n) => n.periode === p).map((n) => n.valeur)));
      const niveaux = e.alertesActives.map((a) => a.niveauRisque);
      return {
        nom: e.nom,
        prenom: e.prenom,
        classe: e.niveau,
        t1: moyenneT(PERIODES[0]),
        t2: moyenneT(PERIODES[1]),
        t3: moyenneT(PERIODES[2]),
        generale: arrondi2(moyenne(notes.map((n) => n.valeur))),
        absencesInjustifiees: e.absencesInjustifiees.filter((a) => a.anneeScolaire === annee).length,
        alerte: niveaux.includes("eleve") ? "eleve" : niveaux.includes("moyen") ? "moyen" : null,
      } satisfies LigneEleve;
    })
    .sort((a, b) => a.classe.localeCompare(b.classe, "fr") || a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr"));
}

export function nomFichierEleves(etablissement: string, genereLe: Date) {
  return nomFichierXlsx(`eleves-${slugFichier(etablissement)}`, genereLe);
}

export function classeurEleves({
  etablissement,
  annee,
  lignes,
  genereLe,
}: {
  etablissement: string;
  annee: string | null;
  lignes: LigneEleve[];
  genereLe: Date;
}) {
  const classeur = nouveauClasseur();
  const feuille = nouvelleFeuille(classeur, "Élèves", {
    titre: "Liste des élèves",
    etablissement,
    genereLe,
    informations: [annee ? `Année scolaire ${annee} — moyennes sur 20` : "Aucune note enregistrée"],
    colonnes: [
      { titre: "Nom", cle: "nom", largeur: 18 },
      { titre: "Prénom", cle: "prenom", largeur: 16 },
      { titre: "Classe", cle: "classe", largeur: 14 },
      ...PERIODES.map((p, i) => ({ titre: `Moyenne ${p}`, cle: `t${i + 1}`, largeur: 20, format: FORMAT_NOTE, alignement: "right" as const })),
      { titre: "Moyenne générale", cle: "generale", largeur: 18, format: FORMAT_NOTE, alignement: "right" },
      { titre: "Absences injustifiées", cle: "absences", largeur: 21, alignement: "right" },
      { titre: "Alerte active", cle: "alerte", largeur: 14 },
    ],
  });

  lignes.forEach((l, i) => {
    const ligne = ajouterLigne(
      feuille,
      {
        nom: l.nom,
        prenom: l.prenom,
        classe: l.classe,
        t1: l.t1,
        t2: l.t2,
        t3: l.t3,
        generale: l.generale,
        absences: l.absencesInjustifiees,
        alerte: l.alerte ? LIBELLES_NIVEAU[l.alerte] : "Aucune",
      },
      i % 2 === 1
    );
    colorerNiveau(ligne.getCell("alerte"), l.alerte);
  });

  const enAlerte = lignes.filter((l) => l.alerte).length;
  styliserTotal(
    ajouterLigne(feuille, {
      nom: `Total : ${lignes.length} élève${lignes.length > 1 ? "s" : ""}`,
      generale: arrondi2(moyenne(lignes.map((l) => l.generale).filter((m): m is number => m !== null))),
      absences: lignes.reduce((s, l) => s + l.absencesInjustifiees, 0),
      alerte: `${enAlerte} en alerte`,
    })
  );
  return classeur;
}
