"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  exact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`border-b-2 px-1 py-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 ${
        isActive
          ? "border-brand text-ink"
          : "border-transparent text-ink-secondary hover:border-ink/30 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
