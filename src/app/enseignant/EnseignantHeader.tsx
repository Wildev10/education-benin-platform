"use client";

import { signOut } from "next-auth/react";
import AccessibilityControls from "@/components/AccessibilityControls";

export default function EnseignantHeader({
  name,
  email,
  spaceLabel = "Espace enseignant",
}: {
  name: string;
  email: string;
  spaceLabel?: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-3 sm:px-8">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-700">
            EduTech Bénin
          </p>
          <p className="mt-0.5 text-sm text-slate-600">{spaceLabel}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white shadow-sm"
            >
              {initials || "U"}
            </div>
            <div className="min-w-0 sm:text-right">
              <p className="truncate font-semibold text-slate-950">{name}</p>
              <p className="max-w-48 truncate text-sm text-slate-600">{email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Se déconnecter
          </button>
          <AccessibilityControls />
        </div>
      </div>
    </header>
  );
}
