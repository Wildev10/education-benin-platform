import type { Metadata } from "next";
import { metadonneesPage } from "@/lib/i18n/metadonnees";
import { AccueilPublic } from "../_AccueilPublic";

export const metadata: Metadata = metadonneesPage("accueil", "en");

/** Version anglaise de la page d'accueil publique. */
export default function HomeEn() {
  return <AccueilPublic langue="en" />;
}
