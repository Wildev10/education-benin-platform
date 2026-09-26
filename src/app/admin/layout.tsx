import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import EnseignantHeader from "../enseignant/EnseignantHeader";

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
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <EnseignantHeader
        name={session.user.name ?? session.user.email ?? "Administrateur"}
        email={session.user.email ?? ""}
        spaceLabel="Espace Ministère"
      />
      <nav aria-label="Navigation administration" className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl gap-6 px-5 sm:px-8">
          <Link
            href="/admin"
            className="border-b-2 border-teal-700 px-1 py-3 text-sm font-semibold text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/etudiants"
            className="border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Étudiants
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
