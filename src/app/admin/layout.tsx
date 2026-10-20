import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { AppNav } from "@/components/AppNav";
import { countDemandesEnAttente } from "@/lib/reset-requests";

export const metadata: Metadata = {
  title: "Espace national — EduTech Bénin",
};

const navItems = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/alertes", label: "Alertes" },
  { href: "/admin/absences", label: "Absences" },
  { href: "/admin/etudiants", label: "Étudiants" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/import", label: "Importer" },
  { href: "/admin/assistant", label: "Assistant" },
  { href: "/admin/historique", label: "Historique" },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const demandesEnAttente = session.user.role === "admin" ? await countDemandesEnAttente() : 0;
  const items = navItems.map((item) =>
    item.href === "/admin/utilisateurs" ? { ...item, badge: demandesEnAttente } : item
  );

  return (
    <div className="min-h-screen bg-page text-ink">
      <AppHeader
        name={session.user.name ?? session.user.email ?? "Administrateur"}
        email={session.user.email ?? ""}
        role={session.user.role}
        spaceLabel="Espace national"
      />
      <AppNav items={items} ariaLabel="Navigation administration" />
      {children}
    </div>
  );
}
