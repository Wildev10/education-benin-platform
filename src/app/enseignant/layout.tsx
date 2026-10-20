import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { AppNav } from "@/components/AppNav";
import { navDirecteur } from "@/app/directeur/navigation";

export const metadata: Metadata = {
  title: "Espace Enseignant — EduTech Bénin",
};

const navItems = [
  { href: "/enseignant", label: "Étudiants", exact: true },
  { href: "/enseignant/alertes", label: "Alertes" },
  { href: "/enseignant/absences", label: "Absences" },
  { href: "/enseignant/import", label: "Importer" },
  { href: "/enseignant/assistant", label: "Assistant" },
];

export default async function EnseignantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Le directeur réutilise les pages élèves de l'espace enseignant avec sa propre navigation
  const estDirecteur = session.user.role === "directeur";

  return (
    <div className="min-h-screen bg-page text-ink">
      <AppHeader
        name={session.user.name ?? session.user.email ?? "Enseignant"}
        email={session.user.email ?? ""}
        role={session.user.role}
        {...(estDirecteur ? { spaceLabel: "Espace Directeur" } : {})}
      />
      <AppNav
        items={estDirecteur ? navDirecteur : navItems}
        ariaLabel={estDirecteur ? "Navigation directeur" : "Navigation enseignant"}
      />
      {children}
    </div>
  );
}
