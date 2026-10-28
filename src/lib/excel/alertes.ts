import { libellePeriode } from "@/lib/notes-trimestres";
import {
  FORMAT_DATE,
  FORMAT_NOTE,
  FORMAT_POURCENT,
  LIBELLES_NIVEAU,
  libelleStatut,
  LIBELLES_TYPE,
  ajouterLigne,
  arrondi2,
  colorerNiveau,
  nomFichierXlsx,
  nouveauClasseur,
  nouvelleFeuille,
  styliserTotal,
} from "./commun";
import { LIBELLES_ACTION } from "@/lib/suivi-alertes";

export type AlerteExcel = {
  type: string;
  niveauRisque: string;
  statut: string;
  suiviDepuis?: Date | null;
  /** Dernière étape du suivi (au plus une) */
  suivis?: { action: string; createdAt: Date }[];
  periode: string;
  /** Absente des anciennes alertes */
  anneeScolaire?: string | null;
  moyenneAvant: number;
  moyenneApres: number;
  ecartPourcent: number;
  createdAt: Date;
  etudiant: {
    nom: string;
    prenom: string;
    niveau: string;
    etablissement: { nom: string };
  };
};

export function nomFichierAlertes(genereLe: Date) {
  return nomFichierXlsx("alertes", genereLe);
}

/** Classeur de la liste des alertes, avec les filtres actifs rappelés en en-tête. */
export function classeurAlertes({
  alertes,
  etablissement,
  filtres,
  genereLe,
}: {
  alertes: AlerteExcel[];
  /** Établissement exporté, ou « Tous les établissements » pour l'admin */
  etablissement: string;
  filtres: string[];
  genereLe: Date;
}) {
  const classeur = nouveauClasseur();
  const feuille = nouvelleFeuille(classeur, "Alertes", {
    titre: "Liste des alertes",
    etablissement,
    genereLe,
    informations: [`Filtres : ${filtres.join(" · ")}`],
    colonnes: [
      { titre: "Nom", cle: "nom", largeur: 18 },
      { titre: "Prénom", cle: "prenom", largeur: 16 },
      { titre: "Classe", cle: "classe", largeur: 14 },
      { titre: "Établissement", cle: "etablissement", largeur: 24 },
      { titre: "Type", cle: "type", largeur: 11 },
      { titre: "Niveau", cle: "niveau", largeur: 10 },
      { titre: "Statut", cle: "statut", largeur: 18 },
      { titre: "Dernière action", cle: "derniereAction", largeur: 24 },
      { titre: "Période", cle: "periode", largeur: 22 },
      { titre: "Moyenne avant", cle: "avant", largeur: 15, format: FORMAT_NOTE, alignement: "right" },
      { titre: "Moyenne après", cle: "apres", largeur: 15, format: FORMAT_NOTE, alignement: "right" },
      { titre: "Baisse", cle: "baisse", largeur: 10, format: FORMAT_POURCENT, alignement: "right" },
      { titre: "Absences injustifiées", cle: "absences", largeur: 21, alignement: "right" },
      { titre: "Détectée le", cle: "date", largeur: 13, format: FORMAT_DATE, alignement: "left" },
    ],
  });

  alertes.forEach((a, i) => {
    const absence = a.type === "absences";
    const ligne = ajouterLigne(
      feuille,
      {
        nom: a.etudiant.nom,
        prenom: a.etudiant.prenom,
        classe: a.etudiant.niveau,
        etablissement: a.etudiant.etablissement.nom,
        type: LIBELLES_TYPE[a.type] ?? a.type,
        niveau: LIBELLES_NIVEAU[a.niveauRisque] ?? a.niveauRisque,
        statut: libelleStatut(a),
        derniereAction: a.suivis?.[0] ? LIBELLES_ACTION[a.suivis[0].action] ?? a.suivis[0].action : "",
        periode: libellePeriode(a.periode, a.anneeScolaire),
        avant: absence ? null : arrondi2(a.moyenneAvant),
        apres: absence ? null : arrondi2(a.moyenneApres),
        baisse: absence ? null : Math.round(a.ecartPourcent * 10) / 10,
        absences: absence ? a.moyenneApres : null,
        date: a.createdAt,
      },
      i % 2 === 1
    );
    colorerNiveau(ligne.getCell("niveau"), a.niveauRisque);
  });

  const eleve = alertes.filter((a) => a.niveauRisque === "eleve").length;
  styliserTotal(
    ajouterLigne(feuille, {
      nom: `Total : ${alertes.length} alerte${alertes.length > 1 ? "s" : ""}`,
      niveau: `${eleve} élevé`,
      statut: `${alertes.length - eleve} moyen`,
    })
  );
  return classeur;
}
