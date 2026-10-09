import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { AppNav } from "@/components/AppNav";

export const metadata: Metadata = {
  title: "Espace Ministère — EduTech Bénin",
};

const navItems = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/etudiants", label: "Étudiants" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/import", label: "Importer" },
  { href: "/admin/assistant", label: "Assistant" },
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

  return (
    <div className="min-h-screen bg-page text-ink">
      <AppHeader
        name={session.user.name ?? session.user.email ?? "Administrateur"}
        email={session.user.email ?? ""}
        spaceLabel="Espace Ministère"
      />
      <AppNav items={navItems} ariaLabel="Navigation administration" />
      {children}
    </div>
  );
}
