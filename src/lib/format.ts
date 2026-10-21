// Formatage unique des nombres affichés (pages, cloche, graphiques, PDF,
// messages, historique) : format français, virgule décimale. Les Excel gardent
// de vraies valeurs numériques et n'utilisent pas ces fonctions.

const ESPACE_INSECABLE = " ";

const formats = new Map<string, Intl.NumberFormat>();

function formatFr(minimum: number, maximum: number): Intl.NumberFormat {
  const cle = `${minimum}-${maximum}`;
  let format = formats.get(cle);
  if (!format) {
    format = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: minimum, maximumFractionDigits: maximum });
    formats.set(cle, format);
  }
  return format;
}

// Séparateur des milliers : l'espace fine insécable d'Intl (U+202F) devient
// une espace insécable ordinaire, présente dans les polices des PDF.
const finaliser = (texte: string) => texte.replace(/ /g, ESPACE_INSECABLE);

/** Nombre avec exactement `decimales` chiffres après la virgule : 12,1 ; 7,80. */
export function formaterNombre(valeur: number, decimales = 1): string {
  return finaliser(formatFr(decimales, decimales).format(valeur));
}

/** Note saisie : jusqu'à deux décimales, sans zéro inutile (15 ; 12,5 ; 12,75). */
export function formaterNote(valeur: number): string {
  return finaliser(formatFr(0, 2).format(valeur));
}

/** Pourcentage : « 35,0 % », espace insécable avant le signe. */
export function formaterPourcent(valeur: number, decimales = 1): string {
  return `${formaterNombre(valeur, decimales)}${ESPACE_INSECABLE}%`;
}

/** Baisse de moyenne (écart positif) : « −35,0 % », avec un vrai signe moins. */
export function formaterBaisse(ecartPourcent: number, decimales = 1): string {
  return `−${formaterPourcent(ecartPourcent, decimales)}`;
}
