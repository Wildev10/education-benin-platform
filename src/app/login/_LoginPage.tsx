"use client";

import Image from "next/image";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import AccessibilityControls from "@/components/AccessibilityControls";
import { useToast } from "@/hooks/useToast";

const features = [
  {
    icon: "📊",
    title: "Suivi en temps réel",
    desc: "Moyennes, absences et alertes mis à jour dès la saisie.",
  },
  {
    icon: "⚡",
    title: "Détection précoce",
    desc: "L'IA repère les baisses de résultats avant le décrochage.",
  },
  {
    icon: "🏫",
    title: "Couverture nationale",
    desc: "Tous les établissements du Bénin sur une seule plateforme.",
  },
];

export default function LoginPageClient() {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState("");
  const [estBloque, setEstBloque] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setEstBloque(false);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        if (res.code === "rate_limit") {
          setEstBloque(true);
        } else {
          setErreur("Email ou mot de passe incorrect.");
        }
        return;
      }

      showToast("Connexion réussie. Bienvenue !", "success");
      router.push("/");
      router.refresh();
    } catch {
      setErreur("La connexion est indisponible. Vérifie ta connexion puis réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* ── Panneau gauche — identité (masqué sur mobile) ────── */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden bg-ink px-8 py-10 lg:flex lg:w-[46%] lg:px-12 lg:py-14"
        aria-label="Présentation de la plateforme"
      >
        {/* Cercles décoratifs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-brand/5"
        />

        {/* Logo + nom */}
        <div className="relative flex items-center gap-3">
          <Image
            src="/armoiries-benin.png"
            alt="Armoiries du Bénin"
            height={40}
            width={40}
            className="shrink-0"
            priority
          />
          <div>
            <p className="text-base font-bold uppercase tracking-[0.16em] text-surface">
              EduTech Bénin
            </p>
            <p className="text-xs text-surface/50">Ministère de l'Éducation</p>
          </div>
        </div>

        {/* Pitch */}
        <div className="relative mt-10 lg:mt-0">
          {/* Armoiries en grand au-dessus du titre */}
          <div className="mb-8 flex justify-center">
            <Image
              src="/armoiries-benin.png"
              alt="Armoiries de la République du Bénin — Fraternité Justice Travail"
              height={120}
              width={120}
              priority
            />
          </div>
          <h1 className="text-3xl font-bold leading-tight text-surface lg:text-4xl">
            La plateforme de suivi
            <br />
            <span className="text-brand">scolaire national</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-surface/70">
            Suivez chaque élève, détectez les difficultés tôt et agissez avant qu'il soit trop tard.
          </p>

          <ul className="mt-8 space-y-5" role="list">
            {features.map((f) => (
              <li key={f.title} className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-xl"
                >
                  {f.icon}
                </span>
                <div>
                  <p className="font-semibold text-surface">{f.title}</p>
                  <p className="mt-0.5 text-sm text-surface/60">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Accessibilité dans l'aside desktop uniquement (mobile : voir panneau form) */}
      </aside>

      {/* ── Panneau droit — formulaire ────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-page px-6 py-12 lg:px-12">
        {/* Accessibilité — visible sur tous les écrans (aside masqué sur mobile) */}
        <div className="mb-8 w-full max-w-md self-end">
          <AccessibilityControls variant="light" />
        </div>

        <div className="w-full max-w-md">
          {/* Logo mobile (répété dans la zone formulaire) */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image
              src="/armoiries-benin.png"
              alt="Armoiries du Bénin"
              height={36}
              width={36}
              className="shrink-0"
            />
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-ink">
                EduTech Bénin
              </p>
              <p className="text-xs text-ink-secondary">Plateforme de suivi scolaire</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-ink">Connexion</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Accédez à votre espace dédié.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-semibold text-ink">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-ink placeholder:text-ink-secondary/50 transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark"
                  placeholder="votre@email.bj"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-semibold text-ink">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark"
                  autoComplete="current-password"
                  required
                />
              </div>

              {estBloque && (
                <div
                  role="alert"
                  className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                >
                  <p className="font-semibold">Accès temporairement bloqué</p>
                  <p className="mt-0.5">
                    Trop de tentatives échouées. Réessayez dans 15 minutes.
                  </p>
                </div>
              )}
              {erreur && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
                >
                  {erreur}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || estBloque}
                className="w-full rounded-lg bg-brand px-4 py-3.5 font-bold text-ink transition hover:bg-brand-dark hover:text-surface focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Connexion…" : "Se connecter"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-ink-secondary">
            Problème de connexion ?{" "}
            <a
              href="mailto:support@edutechbenin.bj"
              className="font-semibold text-brand-dark underline decoration-brand/30 underline-offset-2 hover:decoration-brand focus:outline-none focus:ring-2 focus:ring-brand-dark"
            >
              Contactez l'administration
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
