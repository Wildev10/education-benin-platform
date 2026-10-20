import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "Mon Espace — EduTech Bénin",
};

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
      <AppHeader
        name={session.user.name ?? session.user.email ?? "Étudiant"}
        email={session.user.email ?? ""}
        spaceLabel="Espace étudiant"
      />
      {children}
    </div>
  );
}
