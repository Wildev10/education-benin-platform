import { normaliser } from "@/lib/assistant-referentiel";
import type { Referentiel, Requete } from "@/lib/assistant-referentiel";

/**
 * Analyseur de secours SANS IA, utilisé seulement quand Gemini est
 * indisponible sur tous les modèles. Il repère des mots-clés dans la question
 * et ne retient que des valeurs présentes dans le référentiel (lu en base).
 * Retourne null si la question n'est pas comprise.
 */
export function analyserSansIA(question: string, ref: Referentiel): Requete | null {
  const texte = ` ${normaliser(question)} `;
  const contient = (mot: string) => texte.includes(` ${mot} `);
  const contientRacine = (racine: string) => texte.includes(racine);

  const requete: Requete = { type: "inconnu", filtres: {}, valeursInconnues: [] };

  // 1. Type de données : "risque" et "alerte" -> alertes, sinon étudiants.
  const parleAlertes = contientRacine("alerte") || contientRacine("risque");
  const parleEtudiants =
    contientRacine("etudiant") || contient("eleves") || contient("eleve") || contientRacine("inscrit");

  // 2. Filtres issus du référentiel (établissement, département, commune, niveau).
  const etablissement = ref.etablissements.find((nom) =>
    texte.includes(` ${sansPrefixe(normaliser(nom))} `)
  );
  if (etablissement) requete.filtres.etablissement = etablissement;

  const departement = ref.departements.find((nom) => contient(normaliser(nom)));
  if (departement) requete.filtres.departement = departement;

  const commune = ref.communes.find((nom) => contient(normaliser(nom)));
  if (commune) requete.filtres.commune = commune;

  const niveau = ref.niveaux.find((nom) => contient(normaliser(nom)));
  if (niveau) requete.filtres.niveau = niveau;

  const periode = ref.periodes.find((nom) => {
    const numero = nom.slice(-1);
    return contient(normaliser(nom)) || texte.match(new RegExp(` ${numero} ?(er|e|eme)? trimestre `));
  });
  if (periode) requete.filtres.periode = periode;

  // 3. Filtres propres aux alertes (seulement si la question parle d'alertes).
  if (parleAlertes) {
    requete.type = "alertes";
    if (contientRacine("traite") && !contientRacine("non traite") && !contientRacine("pas traite")) {
      requete.filtres.statutAlerte = "traitee";
    } else if (contientRacine("active") || contientRacine("actif") || contientRacine("non traite") || contientRacine("pas traite") || contientRacine("en cours")) {
      requete.filtres.statutAlerte = "active";
    }
    if (contient("eleve") || contientRacine("grave") || contientRacine("critique")) {
      requete.filtres.niveauRisque = "eleve";
    } else if (contientRacine("moyen")) {
      requete.filtres.niveauRisque = "moyen";
    }
  } else if (parleEtudiants || etablissement || departement || commune || niveau) {
    requete.type = "etudiants";
  }

  if (requete.type === "inconnu") return null;

  // 4. Répartition "par établissement" ou "par niveau".
  if (/ par (etablissement|ecole|lycee|college) /.test(texte)) requete.regrouperPar = "etablissement";
  else if (/ par (niveau|classe) /.test(texte)) requete.regrouperPar = "niveau";

  return requete;
}

// "lycee mathieu bouke" -> "mathieu bouke" : on accepte le nom sans le préfixe.
function sansPrefixe(nom: string) {
  return nom.replace(/^(lycee|college|ecole) /, "");
}
