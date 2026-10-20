import type { Metadata } from "next";
import { metadonneesPage } from "@/lib/i18n/metadonnees";
import { AccueilPublic } from "./_AccueilPublic";

export const metadata: Metadata = metadonneesPage("accueil", "fr");

export default function Home() {
  return <AccueilPublic langue="fr" />;
}
