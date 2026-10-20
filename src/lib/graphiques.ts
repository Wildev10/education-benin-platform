/**
 * Hauteur d'un graphique en barres horizontales : 52 px par barre et 48 px
 * pour l'axe. Partagée par le graphique et son squelette, pour que le
 * chargement du graphique (côté client) ne décale pas la page.
 */
export function hauteurGraphiqueBarres(nbBarres: number) {
  return nbBarres * 52 + 48;
}
