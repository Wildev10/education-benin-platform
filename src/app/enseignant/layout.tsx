import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
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
      <nav aria-label="Navigation enseignant" className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl gap-6 px-5 sm:px-8">
          <Link
            href="/enseignant"
            className="border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Étudiants
          </Link>
          <Link
            href="/enseignant/assistant"
            className="border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Assistant
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
