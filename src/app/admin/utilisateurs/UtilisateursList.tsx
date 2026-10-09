"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, roleVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Toast, Confirm, Swal } from "@/lib/swal";

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

type Etablissement = { id: string; nom: string };

export default function UtilisateursList({
  initialUtilisateurs,
  currentUserId,
  etablissements,
}: {
  initialUtilisateurs: Utilisateur[];
  currentUserId: string;
  etablissements: Etablissement[];
}) {
  const [utilisateurs, setUtilisateurs] = useState(initialUtilisateurs);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleDelete(id: string, nom: string, prenom: string) {
    const result = await Confirm.fire({
      title: "Êtes-vous sûr ?",
      text: `Supprimer le compte de ${prenom} ${nom} ? Cette action est irréversible.`,
      icon: "warning",
      showCancelButton: true,
    });
    if (!result.isConfirmed) return;

    setProcessingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/utilisateurs/${id}`, { method: "DELETE" });
      if (res.status === 403) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Action interdite.");
        void Toast.fire({ icon: "error", title: "Erreur lors de l'opération." });
        return;
      }
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Impossible de supprimer.");
      }
      setUtilisateurs((current) => current.filter((u) => u.id !== id));
      void Toast.fire({ icon: "success", title: "Compte supprimé." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      void Toast.fire({ icon: "error", title: "Erreur lors de l'opération." });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleEdit(utilisateur: Utilisateur) {
    const etabOptions = etablissements
      .map(
        (e) =>
          `<option value="${e.id}" ${e.id === utilisateur.etablissementId ? "selected" : ""}>${e.nom}</option>`
      )
      .join("");

    const rolesWithEtab = ["enseignant", "directeur"];
    const initialShowEtab = rolesWithEtab.includes(utilisateur.role);

    const { value: formValues } = await Swal.fire({
      title: "Modifier le compte",
      width: "min(520px, 94vw)",
      html: `
        <div style="text-align:left">
          <div class="swal-field swal-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
            <div>
              <label class="swal-label" for="swal-prenom">Prénom</label>
              <input id="swal-prenom" class="swal-input" type="text" value="${utilisateur.prenom}" />
            </div>
            <div>
              <label class="swal-label" for="swal-nom">Nom</label>
              <input id="swal-nom" class="swal-input" type="text" value="${utilisateur.nom}" />
            </div>
          </div>
          <div class="swal-field">
            <label class="swal-label" for="swal-email">Email</label>
            <input id="swal-email" class="swal-input" type="email" value="${utilisateur.email}" />
          </div>
          <div class="swal-field">
            <label class="swal-label" for="swal-role">Rôle</label>
            <select id="swal-role" class="swal-select" onchange="
              var v = this.value;
              var row = document.getElementById('swal-etab-row');
              row.style.display = (v === 'enseignant' || v === 'directeur') ? 'block' : 'none';
            ">
              <option value="etudiant" ${utilisateur.role === "etudiant" ? "selected" : ""}>Étudiant</option>
              <option value="enseignant" ${utilisateur.role === "enseignant" ? "selected" : ""}>Enseignant</option>
              <option value="admin" ${utilisateur.role === "admin" ? "selected" : ""}>Admin</option>
              <option value="directeur" ${utilisateur.role === "directeur" ? "selected" : ""}>Directeur</option>
            </select>
          </div>
          <div id="swal-etab-row" class="swal-field" style="display:${initialShowEtab ? "block" : "none"}">
            <label class="swal-label" for="swal-etab">Établissement</label>
            <select id="swal-etab" class="swal-select">
              <option value="">— Choisir un établissement —</option>
              ${etabOptions}
            </select>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Enregistrer",
      cancelButtonText: "Annuler",
      confirmButtonColor: "#F97316",
      cancelButtonColor: "#0A0A0A",
      preConfirm: () => {
        const prenom = (document.getElementById("swal-prenom") as HTMLInputElement).value.trim();
        const nom = (document.getElementById("swal-nom") as HTMLInputElement).value.trim();
        const email = (document.getElementById("swal-email") as HTMLInputElement).value.trim();
        const role = (document.getElementById("swal-role") as HTMLSelectElement).value;
        const etablissementId = (document.getElementById("swal-etab") as HTMLSelectElement).value || null;

        if (!prenom || !nom || !email) {
          Swal.showValidationMessage("Le prénom, le nom et l'email sont requis.");
          return false;
        }
        if ((role === "enseignant" || role === "directeur") && !etablissementId) {
          Swal.showValidationMessage("L'établissement est obligatoire pour un enseignant ou un directeur.");
          return false;
        }
        return { prenom, nom, email, role, etablissementId };
      },
    });

    if (!formValues) return;

    setProcessingId(utilisateur.id);
    try {
      const res = await fetch(`/api/admin/utilisateurs/${utilisateur.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      });

      const data = await res.json() as Utilisateur & { error?: string };

      if (res.status === 403) {
        void Toast.fire({ icon: "warning", title: data.error ?? "Action interdite." });
        return;
      }
      if (!res.ok) {
        void Toast.fire({ icon: "error", title: data.error ?? "Impossible de modifier le compte." });
        return;
      }

      setUtilisateurs((current) =>
        current.map((u) => (u.id === utilisateur.id ? { ...data } : u))
      );
      void Toast.fire({ icon: "success", title: "Compte modifié." });
    } catch {
      void Toast.fire({ icon: "error", title: "Erreur réseau. Veuillez réessayer." });
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
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={processingId === u.id}
                          onClick={() => void handleEdit(u)}
                        >
                          Modifier
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={processingId === u.id}
                          onClick={() => void handleDelete(u.id, u.nom, u.prenom)}
                        >
                          {processingId === u.id ? "…" : "Supprimer"}
                        </Button>
                      </div>
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
