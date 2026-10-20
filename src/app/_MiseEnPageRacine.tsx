import Providers from "./providers";
import type { Metadata, Viewport } from "next";
import type { Langue } from "@/lib/i18n/langue";
import { BandeauHorsLigne } from "@/components/pwa/BandeauHorsLigne";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadataRacine: Metadata = {
  metadataBase: new URL("https://education-benin-platform.vercel.app"),
  title: "EduTech Bénin — Plateforme nationale de suivi scolaire",
  description:
    "Détectez automatiquement les risques de décrochage scolaire. Plateforme nationale de suivi des élèves pour les établissements scolaires du Bénin.",
  robots: "noindex, nofollow",
  openGraph: {
    title: "EduTech Bénin — Plateforme nationale de suivi scolaire",
    description:
      "Détectez automatiquement les risques de décrochage scolaire. Plateforme nationale de suivi des élèves pour les établissements scolaires du Bénin.",
    type: "website",
    url: "https://education-benin-platform.vercel.app",
  },
  applicationName: "EduTech Bénin",
  appleWebApp: { capable: true, title: "EduTech", statusBarStyle: "black" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewportRacine: Viewport = {
  themeColor: "#0A0A0A",
};

/**
 * Structure commune aux deux mises en page racines : (fr)/layout.tsx pour tout
 * le site en français, en/layout.tsx pour /en et /en/login. La langue est fixée
 * par l'emplacement de la page, sans lire la requête : les pages publiques
 * peuvent ainsi être générées à l'avance (statiques).
 */
export function MiseEnPageRacine({ langue, children }: { langue: Langue; children: React.ReactNode }) {
  return (
    <html
      lang={langue}
      className={`${jakarta.variable} h-full antialiased`}
    >
      <Providers>
        <body className="min-h-full flex flex-col">
          <BandeauHorsLigne langue={langue} />
          {children}
        </body>
      </Providers>
    </html>
  );
}
