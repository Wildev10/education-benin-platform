import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EnseignantHeader from "./EnseignantHeader";
import { NavLink } from "@/components/NavLink";

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
      <EnseignantHeader
        name={session.user.name ?? session.user.email ?? "Enseignant"}
        email={session.user.email ?? ""}
      />
      <nav aria-label="Navigation enseignant" className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl gap-6 px-5 sm:px-8">
          <NavLink href="/enseignant" exact>Étudiants</NavLink>
          <NavLink href="/enseignant/assistant">Assistant</NavLink>
        </div>
      </nav>
      {children}
    </div>
  );
}
