/**
 * Réponse 401 d'une route API (session expirée ou déconnectée) : retour à la
 * page de connexion par un rechargement complet.
 */
export function redirigerVersConnexion() {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- rechargement complet voulu : la session a expiré, on repart d'un état client vide (données de l'ancienne session gardées en mémoire) et le proxy revérifie la session côté serveur ; router.push garderait cet état
  window.location.assign("/login");
}
