import Providers from "./providers";
import type { Metadata, Viewport } from "next";
import { BandeauHorsLigne } from "@/components/pwa/BandeauHorsLigne";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${jakarta.variable} h-full antialiased`}
    >
      <Providers>
        <body className="min-h-full flex flex-col">
          <BandeauHorsLigne />
          {children}
        </body>
      </Providers>
    </html>
  );
}
