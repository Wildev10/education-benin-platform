"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Suspense, useEffect, useRef, useState } from "react";
import AccessibilityControls from "@/components/AccessibilityControls";
import NotificationBell from "@/components/NotificationBell";
import { usePwa } from "@/components/pwa/PwaProvider";
import { SynchroUtilisateurPwa } from "@/components/pwa/SynchroUtilisateurPwa";
import { viderCachesPwa } from "@/lib/pwa";

export default function AppHeader({
  name,
  email,
  spaceLabel = "Espace enseignant",
  role,
}: {
  name: string;
  email: string;
  spaceLabel?: string;
  role?: string;
}) {
  const afficherNotifications = role === "admin" || role === "directeur";
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { installationDisponible, installer } = usePwa();

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <header className="bg-ink border-b border-white/10">
      <Suspense fallback={null}>
        <SynchroUtilisateurPwa identifiant={email || name} role={role} />
      </Suspense>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-5 sm:px-8">
        {/* Left: logo + label */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-white p-1">
            <Image
              src="/armoiries-benin.png"
              alt="Armoiries du Bénin"
              height={36}
              width={36}
              priority
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-surface [overflow-wrap:anywhere] sm:text-sm sm:tracking-[0.16em]">
              EduTech Bénin
            </p>
            <p className="mt-0.5 text-xs text-surface/60 [overflow-wrap:anywhere]">{spaceLabel}</p>
          </div>
        </div>

        {/* Right: notifications + avatar dropdown + accessibility */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {afficherNotifications && role && (
            <NotificationBell utilisateur={email || name} role={role} />
          )}

          {/* Avatar dropdown */}
          <div className="relative" ref={containerRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Menu utilisateur"
              onClick={() => setOpen((v) => !v)}
              className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-2 transition sm:gap-3 sm:px-3 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 focus:ring-offset-ink"
            >
              <div
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-ink shadow-sm"
              >
                {initials || "U"}
              </div>
              <div className="hidden min-w-0 md:block md:text-right">
                <p className="truncate text-sm font-semibold text-surface">{name}</p>
                <p className="max-w-48 truncate text-xs text-surface/60">{email}</p>
              </div>
              {/* Chevron */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
                className={`shrink-0 text-surface/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              >
                <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Dropdown */}
            {open && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-ink shadow-xl lg:w-48">
                <div role="menu" aria-label="Options utilisateur">
                  <Link
                    href="/profil"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-surface transition hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Mon profil
                  </Link>
                  {installationDisponible && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        void installer();
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium text-surface transition hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Installer l&apos;application
                    </button>
                  )}
                  <div className="border-t border-white/10" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      setOpen(false);
                      // Rien de ce compte ne doit rester lisible hors ligne par le suivant
                      await viderCachesPwa();
                      void signOut({ callbackUrl: "/login" });
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium text-surface/80 transition hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                  >
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <path d="M6.5 9h8M11 5.5L14.5 9 11 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M11 3H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                    Se déconnecter
                  </button>
                </div>
                {/* Jusqu'à 1024 px : les commandes d'accessibilité, masquées dans l'en-tête, sont ici */}
                <div className="border-t border-white/10 p-3 lg:hidden">
                  <AccessibilityControls />
                </div>
              </div>
            )}
          </div>

          {/* Contrôles accessibilité : dans le menu utilisateur jusqu'à 1024 px */}
          <div className="hidden lg:block">
            <AccessibilityControls />
          </div>
        </div>
      </div>
    </header>
  );
}
