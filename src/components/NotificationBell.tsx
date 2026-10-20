"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { dateEvenement, estNonLue } from "@/lib/notifications";
import { IconeAlerte } from "@/components/ui/Icones";

const libellesNiveau: Record<string, { label: string; cls: string }> = {
  eleve: { label: "Élevé", cls: "border-red-300 bg-red-50 text-red-900" },
  moyen: { label: "Moyen", cls: "border-amber-300 bg-amber-50 text-amber-950" },
};

const libellesType: Record<string, string> = {
  baisse_moyenne: "Baisse de moyenne",
  absences: "Absences",
};

function formaterHeure(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function NotificationBell({
  utilisateur,
  role,
}: {
  utilisateur: string;
  role: string;
}) {
  const { notifications, nonLues, dernierVu, marquerCommeLues } = useNotifications(utilisateur);
  const [open, setOpen] = useState(false);
  // Alertes non lues au moment de l'ouverture, pour les mettre en évidence dans la liste
  const [vuAvantOuverture, setVuAvantOuverture] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const baseFiche = role === "admin" ? "/admin/etudiants" : "/enseignant/etudiants";

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function basculer() {
    if (!open) {
      setVuAvantOuverture(dernierVu);
      marquerCommeLues();
    }
    setOpen((v) => !v);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={nonLues > 0 ? `Notifications : ${nonLues} nouvelle(s) alerte(s)` : "Notifications"}
        onClick={basculer}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-surface transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 focus:ring-offset-ink"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {nonLues > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ring-2 ring-ink"
          >
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Dernières alertes"
          className="fixed inset-x-4 top-20 z-50 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-border bg-surface text-ink shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
        >
          <p className="border-b border-border px-4 py-3 text-sm font-semibold">Dernières alertes</p>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-secondary">Aucune nouvelle alerte.</p>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => {
                const niveau = libellesNiveau[n.niveauRisque];
                const nouvelle = estNonLue(n, vuAvantOuverture);
                const aggravee = n.evenement === "aggravee";
                const precedent = libellesNiveau[n.niveauPrecedent ?? ""]?.label ?? n.niveauPrecedent;
                return (
                  <li key={n.id}>
                    <Link
                      href={`${baseFiche}/${n.etudiant.id}`}
                      onClick={() => setOpen(false)}
                      className={`block px-4 py-3 transition hover:bg-page focus:bg-page focus:outline-none ${nouvelle ? "bg-brand-light" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">
                          {n.etudiant.prenom} {n.etudiant.nom}
                        </p>
                        <time dateTime={dateEvenement(n)} className="shrink-0 text-xs text-ink-secondary">
                          {formaterHeure(dateEvenement(n))}
                        </time>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-secondary">
                        {n.etablissement.nom} · {n.etudiant.niveau}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span
                          data-evenement={aggravee ? "aggravee" : "creee"}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${niveau?.cls ?? "border-border bg-page text-ink-secondary"}`}
                        >
                          <IconeAlerte taille={12} />
                          {aggravee ? `Aggravée : ${precedent} → ${niveau?.label ?? n.niveauRisque}` : niveau?.label ?? n.niveauRisque}
                        </span>
                        <span className="text-xs text-ink-secondary">{libellesType[n.type] ?? n.type}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
