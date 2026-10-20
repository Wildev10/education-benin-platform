import type { Metadata } from "next";
import { metadonneesPage } from "@/lib/i18n/metadonnees";
import HomePage from "../_HomePage";

export const metadata: Metadata = metadonneesPage("accueil", "fr");

/** Page d'accueil publique, statique : une personne connectée est redirigée par le proxy. */
export default function Home() {
  return <HomePage langue="fr" />;
}
