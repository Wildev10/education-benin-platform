"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import AccessibilityControls from "@/components/AccessibilityControls";

function Logo() {
  return (
    <svg
      width="36"
      height="36"
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setErreur("Email ou mot de passe incorrect.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setErreur("La connexion est indisponible. Vérifie ta connexion puis réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-page px-4 py-12">
      <div className="mb-6 w-full max-w-sm">
        <AccessibilityControls variant="light" />
      </div>

      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
        <div className="flex items-center gap-3 bg-ink px-6 py-5">
          <Logo />
          <div>
            <p className="text-base font-semibold uppercase tracking-[0.16em] text-surface">
              EduTech Bénin
            </p>
            <p className="text-xs text-surface/60">Plateforme de suivi scolaire</p>
          </div>
        </div>

        <div className="px-6 py-7">
          <h1 className="text-2xl font-semibold text-ink">Connexion</h1>
          <p className="mt-1 text-sm text-ink-secondary">Entrez vos identifiants pour accéder à votre espace.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-ink placeholder:text-ink-secondary/50 transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark"
                placeholder="votre@email.bj"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark"
                required
              />
            </div>

            {erreur && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                {erreur}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-ink transition hover:bg-brand-dark hover:text-surface focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
