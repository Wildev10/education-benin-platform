import type { Metadata } from "next";
import { metadonneesPage } from "@/lib/i18n/metadonnees";
import LoginPageClient from "./_LoginPage";

export const metadata: Metadata = metadonneesPage("connexion", "fr");

export default function LoginPage() {
  return <LoginPageClient langue="fr" />;
}
