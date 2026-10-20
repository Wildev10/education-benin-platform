import type { Metadata } from "next";
import { metadonneesPage } from "@/lib/i18n/metadonnees";
import HomePage from "../_HomePage";

export const metadata: Metadata = metadonneesPage("accueil", "en");

/** Version anglaise de la page d'accueil publique, statique (redirection des personnes connectées : proxy). */
export default function HomeEn() {
  return <HomePage langue="en" />;
}
