"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

type NavItem = { href: string; label: string; exact?: boolean };

function useIsActive(href: string, exact = false) {
  const pathname = usePathname();
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

function NavItemLink({ href, label, exact = false, onClick }: NavItem & { onClick?: () => void }) {
  const active = useIsActive(href, exact);
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={[
        "border-b-2 px-1 py-3 text-sm font-semibold transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2",
        active
          ? "border-brand text-ink"
          : "border-transparent text-ink-secondary hover:border-ink/30 hover:text-ink",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function MobileNavItem({ href, label, exact = false, onClick }: NavItem & { onClick?: () => void }) {
  const active = useIsActive(href, exact);
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={[
        "block rounded-lg px-4 py-3 text-sm font-semibold transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2",
        active
          ? "bg-brand-light text-ink"
          : "text-ink-secondary hover:bg-page hover:text-ink",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export function AppNav({ items, ariaLabel }: { items: NavItem[]; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <nav aria-label={ariaLabel} className="border-b border-border bg-surface">
      {/* Desktop nav */}
      <div className="mx-auto hidden max-w-7xl gap-6 px-5 sm:flex sm:px-8">
        {items.map((item) => (
          <NavItemLink key={item.href} {...item} />
        ))}
      </div>

      {/* Mobile nav */}
      <div className="relative sm:hidden">
        <div className="flex items-center justify-between px-5 py-1">
          <span className="text-sm font-semibold text-ink-secondary">Navigation</span>
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav-menu"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-page focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2"
          >
            {open ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>

        {open && (
          <div
            ref={menuRef}
            id="mobile-nav-menu"
            role="menu"
            className="absolute left-0 right-0 top-full z-50 border-b border-border bg-surface px-3 pb-3 pt-1 shadow-lg"
          >
            {items.map((item) => (
              <MobileNavItem key={item.href} {...item} onClick={() => setOpen(false)} />
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
