"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import AccessibilityControls from "@/components/AccessibilityControls";

export default function AppHeader({
  name,
  email,
  spaceLabel = "Espace enseignant",
}: {
  name: string;
  email: string;
  spaceLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-3 sm:px-8">
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
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-surface">
              EduTech Bénin
            </p>
            <p className="mt-0.5 text-xs text-surface/60">{spaceLabel}</p>
          </div>
        </div>

        {/* Right: avatar dropdown + accessibility */}
        <div className="flex items-center gap-3">
          {/* Avatar dropdown */}
          <div className="relative" ref={containerRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Menu utilisateur"
              onClick={() => setOpen((v) => !v)}
              className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 focus:ring-offset-ink"
            >
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
              <div
                role="menu"
                aria-label="Options utilisateur"
                className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-ink shadow-xl"
              >
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
                <div className="border-t border-white/10" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
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
            )}
          </div>

          {/* Contrôles accessibilité masqués sur mobile */}
          <div className="hidden sm:block">
            <AccessibilityControls />
          </div>
        </div>
      </div>
    </header>
  );
}
