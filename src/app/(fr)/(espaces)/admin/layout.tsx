import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { AppNav } from "@/components/AppNav";
import { countDemandesEnAttente } from "@/lib/reset-requests";

export const metadata: Metadata = {
  title: "Espace national — EduTech Bénin",
};

const navItems = [
  { href: "/admin", label: "Tableau de bord", exact: true },
  { href: "/admin/alertes", label: "Alertes" },
  { href: "/admin/absences", label: "Absences" },
  { href: "/admin/etudiants", label: "Étudiants" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/import", label: "Importer" },
  { href: "/admin/assistant", label: "Assistant" },
  { href: "/admin/historique", label: "Historique" },
];

const ARIA_NAV = "Navigation administration";

/**
 * Navigation avec le nombre de demandes de réinitialisation en attente. Rendue
 * dans un Suspense : la page est envoyée sans attendre ce comptage, puis le
 * badge apparaît dès qu'il est connu.
 */
async function NavAdmin({ compterDemandes }: { compterDemandes: boolean }) {
  const demandesEnAttente = compterDemandes ? await countDemandesEnAttente() : 0;
  const items = navItems.map((item) =>
    item.href === "/admin/utilisateurs" ? { ...item, badge: demandesEnAttente } : item
  );
  return <AppNav items={items} ariaLabel={ARIA_NAV} />;
}

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-page text-ink">
      <AppHeader
        name={session.user.name ?? session.user.email ?? "Administrateur"}
        email={session.user.email ?? ""}
        role={session.user.role}
        spaceLabel="Espace national"
      />
      <Suspense fallback={<AppNav items={navItems} ariaLabel={ARIA_NAV} />}>
        <NavAdmin compterDemandes={session.user.role === "admin"} />
      </Suspense>
      {children}
    </div>
  );
}
