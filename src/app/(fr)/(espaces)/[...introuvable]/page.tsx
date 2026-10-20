import { notFound } from "next/navigation";

/**
 * Adresse inconnue : avec deux mises en page racines, il n'y a plus de
 * mise en page commune pour la page 404 ; celle-ci renvoie vers
 * (fr)/not-found.tsx, avec le statut 404.
 */
export default function AdresseInconnue() {
  notFound();
}
