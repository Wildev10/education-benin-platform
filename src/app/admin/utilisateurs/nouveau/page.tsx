"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type EtudiantSansCompte = { id: string; nom: string; prenom: string; etablissement: { nom: string } };
type Etablissement = { id: string; nom: string; departement: string; commune: string };

const inputCls = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark";
const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

export default function NouvelUtilisateurPage() {
  const router = useRouter();

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("enseignant");
  const [motDePasse, setMotDePasse] = useState("");
  const [etudiantId, setEtudiantId] = useState("");
  const [etablissementId, setEtablissementId] = useState("");
  const [etudiants, setEtudiants] = useState<EtudiantSansCompte[]>([]);
  const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (role !== "etudiant") return;
    fetch("/api/etudiants?sansCompte=1")
      .then((res) => res.json())
      .then((data: EtudiantSansCompte[]) => {
        setEtudiants(data);
        setEtudiantId(data[0]?.id ?? "");
      })
      .catch(() => setEtudiants([]));
  }, [role]);

  useEffect(() => {
    if (role !== "directeur") return;
    fetch("/api/etablissements")
      .then((res) => res.json())
      .then((data: Etablissement[]) => {
        setEtablissements(data);
        setEtablissementId(data[0]?.id ?? "");
      })
      .catch(() => setEtablissements([]));
  }, [role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const body: Record<string, string> = { prenom, nom, email, role, motDePasse };
      if (role === "etudiant" && etudiantId) body.etudiantId = etudiantId;
      if (role === "directeur" && etablissementId) body.etablissementId = etablissementId;

      const res = await fetch("/api/admin/utilisateurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Impossible de créer le compte.");
        return;
      }
      setSuccess(`Compte créé pour ${data.prenom} ${data.nom} (${data.email}).`);
      setTimeout(() => router.push("/admin/utilisateurs"), 1500);
    } catch {
      setError("La requête a échoué. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
      <Link
        href="/admin/utilisateurs"
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary shadow-sm transition hover:border-brand hover:bg-brand-light hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Retour aux utilisateurs
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">Administration</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Nouveau compte</h1>
        <p className="mt-2 text-ink-secondary">Le mot de passe est temporaire — l'utilisateur devra le changer à sa première connexion.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="prenom" className={labelCls}>Prénom</label>
            <input id="prenom" type="text" required value={prenom} onChange={(e) => setPrenom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="nom" className={labelCls}>Nom</label>
            <input id="nom" type="text" required value={nom} onChange={(e) => setNom(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label htmlFor="email" className={labelCls}>Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="prenom.nom@edutech.bj" />
        </div>

        <div>
          <label htmlFor="role" className={labelCls}>Rôle</label>
          <select id="role" value={role} onChange={(e) => { setRole(e.target.value); setEtudiantId(""); setEtablissementId(""); }} className={inputCls}>
            <option value="enseignant">Enseignant</option>
            <option value="directeur">Directeur</option>
            <option value="etudiant">Étudiant</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {role === "etudiant" && (
          <div>
            <label htmlFor="etudiantId" className={labelCls}>
              Étudiant à lier <span className="font-normal text-ink-secondary">(optionnel)</span>
            </label>
            {etudiants.length > 0 ? (
              <select
                id="etudiantId"
                value={etudiantId}
                onChange={(e) => setEtudiantId(e.target.value)}
                className={inputCls}
              >
                <option value="">— Ne pas lier à un étudiant —</option>
                {etudiants.map((et) => (
                  <option key={et.id} value={et.id}>
                    {et.prenom} {et.nom} — {et.etablissement.nom}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-lg bg-page px-4 py-3 text-sm text-ink-secondary">
                Tous les étudiants ont déjà un compte, ou aucun étudiant n'est enregistré.
              </p>
            )}
          </div>
        )}

        {role === "directeur" && (
          <div>
            <label htmlFor="etablissementId" className={labelCls}>Établissement</label>
            {etablissements.length > 0 ? (
              <select
                id="etablissementId"
                required
                value={etablissementId}
                onChange={(e) => setEtablissementId(e.target.value)}
                className={inputCls}
              >
                <option value="">— Choisir un établissement —</option>
                {etablissements.map((et) => (
                  <option key={et.id} value={et.id}>
                    {et.nom} ({et.commune}, {et.departement})
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-lg bg-page px-4 py-3 text-sm text-ink-secondary">
                Chargement des établissements…
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="motDePasse" className={labelCls}>Mot de passe temporaire</label>
          <input
            id="motDePasse"
            type="password"
            required
            minLength={8}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className={inputCls}
            aria-describedby="mdp-hint"
          />
          <p id="mdp-hint" className="mt-1 text-xs text-ink-secondary">Minimum 8 caractères.</p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {success}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full justify-center py-3">
          {loading ? "Création…" : "Créer le compte"}
        </Button>
      </form>
    </main>
  );
}
