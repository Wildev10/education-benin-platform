"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge, roleVariant } from "@/components/ui/Badge";
import { Toast } from "@/lib/swal";

type ProfilData = {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  createdAt: string | Date;
  etablissement: { nom: string; departement: string } | null;
  etudiant: {
    nom: string;
    prenom: string;
    niveau: string;
    etablissement: { nom: string } | null;
  } | null;
};

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const hasLength = password.length >= 8;
  const hasDigit = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);

  let strength: "weak" | "medium" | "strong";
  let label: string;
  let barCls: string;
  let textCls: string;

  if (!hasLength) {
    strength = "weak";
    label = "Trop court (minimum 8 caractères)";
    barCls = "bg-red-500";
    textCls = "text-red-700";
  } else if (!hasDigit || !hasUpper) {
    strength = "medium";
    label = "Moyen — ajoutez une majuscule et un chiffre";
    barCls = "bg-amber-500";
    textCls = "text-amber-700";
  } else {
    strength = "strong";
    label = "Fort";
    barCls = "bg-emerald-500";
    textCls = "text-emerald-700";
  }

  const widths = { weak: "w-1/3", medium: "w-2/3", strong: "w-full" };

  return (
    <div className="mt-2 space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barCls} ${widths[strength]}`}
          aria-hidden="true"
        />
      </div>
      <p className={`text-xs font-medium ${textCls}`}>{label}</p>
    </div>
  );
}

function EyeButton({
  show,
  onToggle,
  label,
}: {
  show: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-1 rounded"
    >
      {show ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
        </svg>
      )}
    </button>
  );
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ProfilClient({ initialData }: { initialData: ProfilData }) {
  const [profil, setProfil] = useState(initialData);

  // Section 2 — Modifier les infos
  const [nom, setNom] = useState(initialData.nom);
  const [prenom, setPrenom] = useState(initialData.prenom);
  const [infoLoading, setInfoLoading] = useState(false);

  // Section 3 — Mot de passe
  const [motDePasseActuel, setMotDePasseActuel] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showActuel, setShowActuel] = useState(false);
  const [showNouveau, setShowNouveau] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  const initiales =
    `${profil.prenom[0] ?? ""}${profil.nom[0] ?? ""}`.toUpperCase();

  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim() || !prenom.trim()) {
      void Toast.fire({ icon: "error", title: "Le nom et le prénom sont requis." });
      return;
    }
    setInfoLoading(true);
    try {
      const res = await fetch("/api/profil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom.trim(), prenom: prenom.trim() }),
      });
      const data = await res.json() as ProfilData & { error?: string };
      if (!res.ok) {
        void Toast.fire({ icon: "error", title: data.error ?? "Erreur lors de la mise à jour." });
        return;
      }
      setProfil(data);
      setNom(data.nom);
      setPrenom(data.prenom);
      void Toast.fire({ icon: "success", title: "Profil mis à jour." });
    } catch {
      void Toast.fire({ icon: "error", title: "Erreur réseau. Veuillez réessayer." });
    } finally {
      setInfoLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwdLoading(true);
    try {
      const res = await fetch("/api/profil/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motDePasseActuel, nouveauMotDePasse, confirmation }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) {
        void Toast.fire({ icon: "error", title: data.error ?? "Erreur lors du changement de mot de passe." });
        return;
      }
      void Toast.fire({ icon: "success", title: "Mot de passe modifié." });
      setMotDePasseActuel("");
      setNouveauMotDePasse("");
      setConfirmation("");
    } catch {
      void Toast.fire({ icon: "error", title: "Erreur réseau. Veuillez réessayer." });
    } finally {
      setPwdLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">
          Compte
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Mon profil
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* SECTION 1 — Carte identité */}
        <Card as="section" padding="lg" className="flex flex-col items-center text-center lg:items-start lg:text-left">
          {/* Avatar */}
          <div
            aria-hidden="true"
            className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-2xl font-bold text-ink shadow-md"
          >
            {initiales || "?"}
          </div>

          {/* Nom complet + badge */}
          <div className="mt-5 space-y-2">
            <h2 className="text-2xl font-bold text-ink">
              {profil.prenom} {profil.nom}
            </h2>
            <div className="flex justify-center lg:justify-start">
              <Badge variant={roleVariant(profil.role)} />
            </div>
          </div>

          {/* Email */}
          <p className="mt-4 text-sm text-ink-secondary break-all">{profil.email}</p>

          {/* Établissement */}
          {profil.etablissement && (
            <div className="mt-4 flex items-start gap-2 text-sm text-ink-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{profil.etablissement.nom}</span>
            </div>
          )}

          {/* Date inscription */}
          <p className="mt-4 text-xs text-ink-secondary">
            Membre depuis le {formatDate(profil.createdAt)}
          </p>

          {/* Infos étudiant lié */}
          {profil.etudiant && (
            <div className="mt-5 w-full rounded-xl border border-border bg-page p-4 text-left text-sm space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-dark">
                Dossier étudiant
              </p>
              <p className="font-semibold text-ink">
                {profil.etudiant.prenom} {profil.etudiant.nom}
              </p>
              <p className="text-ink-secondary">Niveau : {profil.etudiant.niveau}</p>
              {profil.etudiant.etablissement && (
                <p className="text-ink-secondary">{profil.etudiant.etablissement.nom}</p>
              )}
            </div>
          )}
        </Card>

        {/* SECTIONS 2 & 3 — Formulaires */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* SECTION 2 — Modifier les informations */}
          <Card as="section" padding="lg">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">
              Informations personnelles
            </p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Modifier le profil</h2>

            <form onSubmit={(e) => void handleInfoSubmit(e)} className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Input
                label="Prénom"
                id="prenom"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                required
                autoComplete="given-name"
              />
              <Input
                label="Nom"
                id="nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
                autoComplete="family-name"
              />
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={infoLoading}
                  className="w-full sm:w-auto"
                >
                  {infoLoading ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </div>
            </form>
          </Card>

          {/* SECTION 3 — Changer le mot de passe */}
          <Card as="section" padding="lg">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">
              Sécurité
            </p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Changer le mot de passe</h2>

            <form onSubmit={(e) => void handlePasswordSubmit(e)} className="mt-6 space-y-5">
              {/* Mot de passe actuel */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mdp-actuel" className="text-sm font-semibold text-ink">
                  Mot de passe actuel <span aria-hidden="true" className="ml-1 text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    id="mdp-actuel"
                    type={showActuel ? "text" : "password"}
                    value={motDePasseActuel}
                    onChange={(e) => setMotDePasseActuel(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-11 text-ink placeholder:text-ink-secondary/50 transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark"
                  />
                  <EyeButton
                    show={showActuel}
                    onToggle={() => setShowActuel((v) => !v)}
                    label={showActuel ? "Masquer le mot de passe actuel" : "Afficher le mot de passe actuel"}
                  />
                </div>
              </div>

              {/* Nouveau mot de passe */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mdp-nouveau" className="text-sm font-semibold text-ink">
                  Nouveau mot de passe <span aria-hidden="true" className="ml-1 text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    id="mdp-nouveau"
                    type={showNouveau ? "text" : "password"}
                    value={nouveauMotDePasse}
                    onChange={(e) => setNouveauMotDePasse(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-11 text-ink placeholder:text-ink-secondary/50 transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark"
                  />
                  <EyeButton
                    show={showNouveau}
                    onToggle={() => setShowNouveau((v) => !v)}
                    label={showNouveau ? "Masquer le nouveau mot de passe" : "Afficher le nouveau mot de passe"}
                  />
                </div>
                <PasswordStrength password={nouveauMotDePasse} />
              </div>

              {/* Confirmation */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mdp-confirmation" className="text-sm font-semibold text-ink">
                  Confirmer le nouveau mot de passe <span aria-hidden="true" className="ml-1 text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    id="mdp-confirmation"
                    type={showConfirmation ? "text" : "password"}
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-11 text-ink placeholder:text-ink-secondary/50 transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark"
                  />
                  <EyeButton
                    show={showConfirmation}
                    onToggle={() => setShowConfirmation((v) => !v)}
                    label={showConfirmation ? "Masquer la confirmation" : "Afficher la confirmation"}
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="secondary"
                size="md"
                disabled={pwdLoading}
                className="w-full sm:w-auto"
              >
                {pwdLoading ? "Enregistrement…" : "Changer le mot de passe"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
}
