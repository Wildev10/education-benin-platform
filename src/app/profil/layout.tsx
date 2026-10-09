import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "Mon profil — EduTech Bénin",
};

const spaceLabels: Record<string, string> = {
  admin: "Espace Ministère",
  enseignant: "Espace Enseignant",
  directeur: "Espace Directeur",
  etudiant: "Mon Espace",
};

export default async function ProfilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const spaceLabel = spaceLabels[session.user.role] ?? "Mon Espace";

  return (
    <div className="min-h-screen bg-page text-ink">
      <AppHeader
        name={session.user.name ?? session.user.email ?? "Utilisateur"}
        email={session.user.email ?? ""}
        spaceLabel={spaceLabel}
      />
      {children}
    </div>
  );
}
