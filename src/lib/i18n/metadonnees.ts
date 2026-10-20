import type { Metadata } from "next";
import { CHEMINS, LANGUES, type Langue, type PagePublique } from "./langue";
import { TEXTES } from "./textes";

/**
 * Métadonnées d'une page publique dans une langue : titre, description,
 * Open Graph, adresse canonique et balises hreflang vers chaque version
 * (x-default : le français). Les adresses relatives sont complétées par
 * metadataBase (mise en page racine).
 */
export function metadonneesPage(page: PagePublique, langue: Langue): Metadata {
  const t = TEXTES[langue].metadonnees;
  const { titre, description } = t[page];
  const chemins = CHEMINS[page];
  return {
    title: titre,
    description,
    alternates: {
      canonical: chemins[langue],
      languages: { fr: chemins.fr, en: chemins.en, "x-default": chemins.fr },
    },
    openGraph: {
      title: titre,
      description,
      type: "website",
      siteName: "EduTech Bénin",
      url: chemins[langue],
      locale: t.localeOpenGraph,
      alternateLocale: LANGUES.filter((l) => l !== langue).map((l) => TEXTES[l].metadonnees.localeOpenGraph),
    },
  };
}
