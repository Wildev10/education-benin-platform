import type { Metadata } from "next";
import { metadonneesPage } from "@/lib/i18n/metadonnees";
import LoginPageClient from "../../login/_LoginPage";

export const metadata: Metadata = metadonneesPage("connexion", "en");

/** Version anglaise de la page de connexion ; après connexion, l'espace reste en français. */
export default function LoginPageEn() {
  return <LoginPageClient langue="en" />;
}
