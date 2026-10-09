"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, roleVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";

type Utilisateur = {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  etudiantId: string | null;
  etablissementId: string | null;
  etablissement: { nom: string } | null;
  createdAt: string;
};

export default function UtilisateursList({
  initialUtilisateurs,
  currentUserId,
}: {
  initialUtilisateurs: Utilisateur[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
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
        showToast("Erreur lors de l'opération.", "error");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Impossible de supprimer.");
      }
      setUtilisateurs((current) => current.filter((u) => u.id !== id));
      showToast("Compte supprimé.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      showToast("Erreur lors de l'opération.", "error");
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

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-ink text-surface">
              <th scope="col" className="px-5 py-4 text-left font-semibold">Utilisateur</th>
              <th scope="col" className="hidden px-5 py-4 text-left font-semibold sm:table-cell">Email</th>
              <th scope="col" className="px-5 py-4 text-left font-semibold">Rôle</th>
              <th scope="col" className="hidden px-5 py-4 text-left font-semibold lg:table-cell">Créé le</th>
              <th scope="col" className="px-5 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {utilisateurs.map((u, i) => (
              <tr key={u.id} className={`transition hover:bg-brand-light/40 ${i % 2 === 1 ? "bg-page" : "bg-surface"}`}>
                <td className="px-5 py-4">
                  <p className="font-semibold text-ink">{u.prenom} {u.nom}</p>
                  <p className="mt-0.5 text-xs text-ink-secondary sm:hidden">{u.email}</p>
                </td>
                <td className="hidden px-5 py-4 text-ink-secondary sm:table-cell">{u.email}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={roleVariant(u.role)} />
                    {u.role === "etudiant" && u.etudiantId && (
                      <Link
                        href={`/admin/etudiants/${u.etudiantId}`}
                        className="text-xs font-medium text-brand-dark underline decoration-brand/30 underline-offset-2 hover:decoration-brand focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-1"
                      >
                        Fiche →
                      </Link>
                    )}
                    {u.role === "directeur" && u.etablissement && (
                      <span className="text-xs text-ink-secondary">{u.etablissement.nom}</span>
                    )}
                  </div>
                </td>
                <td className="hidden px-5 py-4 text-ink-secondary lg:table-cell">
                  {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
                    new Date(u.createdAt)
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  {u.id === currentUserId ? (
                    <span className="text-xs text-ink-secondary">Votre compte</span>
                  ) : (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={processingId === u.id}
                      onClick={() => void handleDelete(u.id, u.nom, u.prenom)}
                    >
                      {processingId === u.id ? "Suppression…" : "Supprimer"}
                    </Button>
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
      </div>
    </>
  );
}
