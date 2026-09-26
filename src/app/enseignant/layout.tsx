import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EnseignantHeader from "./EnseignantHeader";

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
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <EnseignantHeader
        name={session.user.name ?? session.user.email ?? "Enseignant"}
        email={session.user.email ?? ""}
      />
      {children}
    </div>
  );
}
