import Providers from "./providers";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { EN_TETE_LANGUE, estLangue, LANGUE_PAR_DEFAUT } from "@/lib/i18n/langue";
import { BandeauHorsLigne } from "@/components/pwa/BandeauHorsLigne";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://education-benin-platform.vercel.app"),
  title: "EduTech Bénin — Plateforme de suivi scolaire",
  description:
    "Détectez automatiquement les risques de décrochage scolaire. Plateforme de suivi des élèves pour les établissements et le Ministère de l'Éducation du Bénin.",
  robots: "noindex, nofollow",
  openGraph: {
    title: "EduTech Bénin — Plateforme de suivi scolaire",
    description:
      "Détectez automatiquement les risques de décrochage scolaire. Plateforme de suivi des élèves pour les établissements et le Ministère de l'Éducation du Bénin.",
    type: "website",
    url: "https://education-benin-platform.vercel.app",
  },
  applicationName: "EduTech Bénin",
  appleWebApp: { capable: true, title: "EduTech", statusBarStyle: "black" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Langue posée par le proxy : anglais seulement sur /en et /en/login, français partout ailleurs
  const valeur = (await headers()).get(EN_TETE_LANGUE);
  const langue = estLangue(valeur) ? valeur : LANGUE_PAR_DEFAUT;
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
