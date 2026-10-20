"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { BlocIdentite, MentionChallenge } from "@/components/IdentitePlateforme";
import { SelecteurLangue } from "@/components/SelecteurLangue";
import { CHEMINS, type Langue } from "@/lib/i18n/langue";
import { TEXTES } from "@/lib/i18n/textes";

/* ── Intersection Observer hook for scroll animations ── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      el.classList.add("revealed");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("revealed");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`reveal-section ${className}`}>
      {children}
    </div>
  );
}

/* ── Data ── */

const stats = [
  { value: "70+", cle: "eleves" },
  { value: "4", cle: "etablissements" },
  { value: "24/7", cle: "detection" },
  { value: "100%", cle: "accessible" },
] as const;

const steps = [
  {
    num: "1",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    num: "2",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    num: "3",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

const spaces = [
  {
    cle: "etudiant",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    cle: "enseignant",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    cle: "directeur",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    cle: "national",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
] as const;

const a11yPoints = [
  {
    cle: "contraste",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
        <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/>
      </svg>
    ),
  },
  {
    cle: "police",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7V4h16v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 20h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 4v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    cle: "lecture",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    cle: "langue",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
] as const;

/* ── Component ── */

export default function HomePage({ langue }: { langue: Langue }) {
  const t = TEXTES[langue];
  const a = t.accueil;
  const connexion = CHEMINS.connexion[langue];
  return (
    <>
      {/* ── HEADER ── */}
      <header className="bg-ink">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-white p-1">
              <Image
                src="/armoiries-benin.png"
                alt={t.commun.armoiriesAlt}
                height={36}
                width={36}
                priority
              />
            </div>
            <BlocIdentite langue={langue} />
          </div>
          <div className="flex items-center gap-3">
            <SelecteurLangue page="accueil" langue={langue} />
            <Link
              href={connexion}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-brand-dark hover:text-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              {a.seConnecter}
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-ink">
        {/* Watermark armoiries */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <Image
            src="/armoiries-benin.png"
            alt=""
            height={500}
            width={500}
            className="select-none opacity-[0.06] invert"
          />
        </div>

        <div className="relative mx-auto max-w-4xl px-5 py-20 text-center sm:px-8 sm:py-28 lg:py-36">
          <Reveal>
            <h1 className="text-3xl font-bold leading-tight text-surface sm:text-4xl lg:text-5xl">
              {a.titreLigne1}
              <br className="hidden sm:block" />
              {" "}{a.titreLigne2}
            </h1>
            <p className="mt-4 text-xl font-bold text-brand sm:text-2xl lg:text-3xl">
              {a.accroche}
            </p>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-surface/70">
              {a.presentation}
            </p>
            <Link
              href={connexion}
              className="mt-10 inline-flex h-12 items-center justify-center rounded-lg bg-brand px-8 text-base font-bold text-ink transition hover:bg-brand-dark hover:text-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              {a.acceder}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── CHIFFRES CLÉS ── */}
      <section className="bg-page">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <Reveal>
            <div className="grid grid-cols-2 gap-8 text-center lg:grid-cols-4">
              {stats.map((s) => (
                <div key={s.cle}>
                  <p className="text-4xl font-bold text-brand sm:text-5xl">{s.value}</p>
                  <p className="mt-2 text-sm font-semibold text-ink-secondary sm:text-base">{a.chiffres[s.cle]}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ── */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <Reveal>
            <h2 className="text-center text-2xl font-bold text-ink sm:text-3xl">
              {a.commentCaMarche}
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <Reveal key={step.num}>
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                    {step.icon}
                  </div>
                  <span className="mt-4 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-surface">
                    {step.num}
                  </span>
                  <h3 className="mt-3 text-lg font-bold text-ink">{a.etapes[i].titre}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{a.etapes[i].description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── LES 4 ESPACES ── */}
      <section className="bg-page">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <Reveal>
            <h2 className="text-center text-2xl font-bold text-ink sm:text-3xl">
              {a.titreEspaces}
            </h2>
          </Reveal>
          <div className="mt-12 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {spaces.map((space) => (
              <Reveal key={space.cle}>
                <div className="h-full rounded-2xl border border-border bg-surface p-6 shadow-sm transition hover:border-brand/40 hover:shadow-md">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    {space.icon}
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-ink">{a.espaces[space.cle].titre}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{a.espaces[space.cle].description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── ACCESSIBILITÉ ── */}
      <section className="bg-ink">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
          <Reveal>
            <h2 className="text-center text-2xl font-bold text-surface sm:text-3xl">
              {a.titreAccessibilite}
            </h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-2 gap-8 lg:grid-cols-4">
            {a11yPoints.map((pt) => (
              <Reveal key={pt.cle}>
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15 text-brand">
                    {pt.icon}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-surface/80">{a.accessibilite[pt.cle]}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/10 bg-ink">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-5 py-8 sm:flex-row sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-lg bg-white p-0.5">
              <Image
                src="/armoiries-benin.png"
                alt={t.commun.armoiriesAlt}
                height={24}
                width={24}
              />
            </div>
            <div className="text-sm text-surface/60">
              <p>{a.piedDePage}</p>
              <MentionChallenge langue={langue} className="mt-1 text-xs text-surface/50" />
            </div>
          </div>
          <Link
            href={connexion}
            className="text-sm font-semibold text-brand underline decoration-brand/30 underline-offset-2 transition hover:decoration-brand"
          >
            {a.seConnecter}
          </Link>
        </div>
      </footer>

      {/* ── CSS for reveal animation ── */}
      <style jsx global>{`
        .reveal-section {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .reveal-section.revealed {
          opacity: 1;
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .reveal-section {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }
      `}</style>
    </>
  );
}
