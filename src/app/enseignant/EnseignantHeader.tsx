"use client";

import { signOut } from "next-auth/react";

export default function EnseignantHeader({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
            EduTech Bénin
          </p>
          <p className="mt-1 text-sm text-slate-600">Espace enseignant</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="font-semibold text-slate-900">{name}</p>
            <p className="text-sm text-slate-600">{email}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </header>
  );
}
