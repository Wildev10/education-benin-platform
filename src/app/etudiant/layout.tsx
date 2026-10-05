import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EnseignantHeader from "../enseignant/EnseignantHeader";

export default async function EtudiantLayout({
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
        name={session.user.name ?? session.user.email ?? "Étudiant"}
        email={session.user.email ?? ""}
        spaceLabel="Espace étudiant"
      />
      {children}
    </div>
  );
}
