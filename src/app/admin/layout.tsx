import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { NavLink } from "@/components/NavLink";

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
      <nav aria-label="Navigation administration" className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl gap-6 px-5 sm:px-8">
          <NavLink href="/admin" exact>Dashboard</NavLink>
          <NavLink href="/admin/etudiants">Étudiants</NavLink>
          <NavLink href="/admin/utilisateurs">Utilisateurs</NavLink>
          <NavLink href="/admin/import">Importer</NavLink>
          <NavLink href="/admin/assistant">Assistant</NavLink>
        </div>
      </nav>
      {children}
    </div>
  );
}
