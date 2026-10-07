import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { AppNav } from "@/components/AppNav";

const navItems = [
  { href: "/enseignant", label: "Étudiants", exact: true },
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

  return (
    <div className="min-h-screen bg-page text-ink">
      <AppHeader
        name={session.user.name ?? session.user.email ?? "Enseignant"}
        email={session.user.email ?? ""}
      />
      <AppNav items={navItems} ariaLabel="Navigation enseignant" />
      {children}
    </div>
  );
}
