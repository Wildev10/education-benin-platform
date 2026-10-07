"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Utilisateur = {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  etudiantId: string | null;
  createdAt: string;
};

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: "border-red-300 bg-red-50 text-red-800",
    enseignant: "border-emerald-300 bg-emerald-50 text-emerald-800",
    etudiant: "border-blue-300 bg-blue-50 text-blue-800",
  };
  const labels: Record<string, string> = {
    admin: "Admin",
    enseignant: "Enseignant",
    etudiant: "Étudiant",
  };
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[role] ?? "border-border bg-page text-ink-secondary"}`}>
      {labels[role] ?? role}
    </span>
  );
}

export default function UtilisateursList({
  initialUtilisateurs,
  currentUserId,
}: {
  initialUtilisateurs: Utilisateur[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [utilisateurs, setUtilisateurs] = useState(initialUtilisateurs);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleDelete(id: string, nom: string, prenom: string) {
    const confirme = window.confirm(
      `Supprimer le compte de ${prenom} ${nom} ?\n\nCette action est irréversible.`
    );
    if (!confirme) return;

    setProcessingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/utilisateurs/${id}`, { method: "DELETE" });
      if (res.status === 403) {
        const data = await res.json();
        setError(data.error ?? "Action interdite.");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Impossible de supprimer.");
      }
      setUtilisateurs((current) => current.filter((u) => u.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 font-medium text-red-800">
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink text-surface">
              <th scope="col" className="px-5 py-3.5 text-left font-semibold">Utilisateur</th>
              <th scope="col" className="hidden px-5 py-3.5 text-left font-semibold sm:table-cell">Email</th>
              <th scope="col" className="px-5 py-3.5 text-left font-semibold">Rôle</th>
              <th scope="col" className="hidden px-5 py-3.5 text-left font-semibold lg:table-cell">Créé le</th>
              <th scope="col" className="px-5 py-3.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {utilisateurs.map((u) => (
              <tr key={u.id} className="odd:bg-page transition hover:bg-brand-light/40">
                <td className="px-5 py-4">
                  <p className="font-semibold text-ink">{u.prenom} {u.nom}</p>
                  <p className="mt-0.5 text-xs text-ink-secondary sm:hidden">{u.email}</p>
                </td>
                <td className="hidden px-5 py-4 text-ink-secondary sm:table-cell">{u.email}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <RoleBadge role={u.role} />
                    {u.role === "etudiant" && u.etudiantId && (
                      <Link
                        href={`/admin/etudiants/${u.etudiantId}`}
                        className="text-xs font-medium text-brand-dark underline decoration-brand/30 underline-offset-2 hover:decoration-brand focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-1"
                      >
                        Fiche →
                      </Link>
                    )}
                  </div>
                </td>
                <td className="hidden px-5 py-4 text-ink-secondary lg:table-cell">
                  {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(u.createdAt))}
                </td>
                <td className="px-5 py-4 text-right">
                  {u.id === currentUserId ? (
                    <span className="text-xs text-ink-secondary">Votre compte</span>
                  ) : (
                    <button
                      type="button"
                      disabled={processingId === u.id}
                      onClick={() => void handleDelete(u.id, u.nom, u.prenom)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {processingId === u.id ? "Suppression…" : "Supprimer"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {utilisateurs.length === 0 && (
          <p className="px-5 py-8 text-center text-ink-secondary">Aucun utilisateur.</p>
        )}
      </div>
    </>
  );
}
