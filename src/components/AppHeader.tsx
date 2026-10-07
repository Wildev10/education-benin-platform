"use client";

import { signOut } from "next-auth/react";
import AccessibilityControls from "@/components/AccessibilityControls";

function Logo() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill="#F97316" />
      <rect x="8" y="10" width="16" height="2.5" rx="1.25" fill="#0A0A0A" />
      <rect x="8" y="14.75" width="11" height="2.5" rx="1.25" fill="#0A0A0A" />
      <rect x="8" y="19.5" width="16" height="2.5" rx="1.25" fill="#0A0A0A" />
    </svg>
  );
}

export default function AppHeader({
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
    <header className="bg-ink border-b border-white/10">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-surface">
              EduTech Bénin
            </p>
            <p className="mt-0.5 text-xs text-surface/60">{spaceLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Carte utilisateur : avatar toujours visible, texte masqué sur mobile */}
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-ink shadow-sm"
            >
              {initials || "U"}
            </div>
            <div className="hidden min-w-0 sm:block sm:text-right">
              <p className="truncate text-sm font-semibold text-surface">{name}</p>
              <p className="max-w-48 truncate text-xs text-surface/60">{email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="whitespace-nowrap rounded-lg border border-white/20 px-3 py-2.5 text-sm font-semibold text-surface transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 focus:ring-offset-ink"
          >
            <span className="hidden sm:inline">Se déconnecter</span>
            <span className="sm:hidden" aria-label="Se déconnecter">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M6.5 9h8M11 5.5L14.5 9 11 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 3H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </span>
          </button>
          {/* Contrôles accessibilité masqués sur mobile pour ne pas surcharger le header */}
          <div className="hidden sm:block">
            <AccessibilityControls />
          </div>
        </div>
      </div>
    </header>
  );
}
