import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { AppNav } from "@/components/AppNav";
import { navDirecteur } from "./navigation";

export const metadata: Metadata = {
  title: "Espace Directeur — EduTech Bénin",
};

export default async function DirecteurLayout({
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
        name={session.user.name ?? session.user.email ?? "Directeur"}
        email={session.user.email ?? ""}
        spaceLabel="Espace Directeur"
        role={session.user.role}
      />
      <AppNav items={navDirecteur} ariaLabel="Navigation directeur" />
      {children}
    </div>
  );
}
