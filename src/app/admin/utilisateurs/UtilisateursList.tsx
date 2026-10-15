"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, roleVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { generateTempPassword } from "@/lib/generate-password";
import type { DemandeReinitialisation } from "@/lib/reset-requests";
import { Toast, Confirm, Swal } from "@/lib/swal";

const dateDemandeFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Porto-Novo",
});

function echapperHtml(texte: string) {
  return texte.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

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
  initialDemandes,
}: {
  initialUtilisateurs: Utilisateur[];
  currentUserId: string;
  etablissements: Etablissement[];
  initialDemandes: DemandeReinitialisation[];
}) {
  const router = useRouter();
  const [utilisateurs, setUtilisateurs] = useState(initialUtilisateurs);
  const [demandes, setDemandes] = useState(initialDemandes);
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

  async function handleResetDemande(demande: DemandeReinitialisation) {
    const utilisateur = utilisateurs.find((u) => u.id === demande.user.id);
    if (!utilisateur) {
      void Toast.fire({ icon: "error", title: "Compte introuvable dans la liste." });
      return;
    }

    const motDePasse = await handleEdit(utilisateur, generateTempPassword());
    if (!motDePasse) return;

    const res = await fetch(`/api/admin/reset-requests/${demande.id}`, { method: "PATCH" }).catch(() => null);
    if (res?.ok) {
      setDemandes((current) => current.filter((d) => d.id !== demande.id));
      router.refresh();
    } else {
      void Toast.fire({ icon: "warning", title: "Mot de passe changé, mais la demande n'a pas pu être clôturée." });
    }

    await Swal.fire({
      title: "Mot de passe temporaire",
      html: `Communiquez ce mot de passe à l'utilisateur :<br>
        <strong style="font-size:1.5rem;letter-spacing:0.1em">${echapperHtml(motDePasse)}</strong>`,
      icon: "success",
      confirmButtonText: "Copié !",
      confirmButtonColor: "#F97316",
    });
    void Toast.fire({
      icon: "success",
      title: "Mot de passe réinitialisé. Communiquez le mot de passe temporaire à l'utilisateur.",
    });
  }

  async function handleEdit(utilisateur: Utilisateur, motDePasseTemporaire?: string): Promise<string | null> {
    const modeReinitialisation = motDePasseTemporaire !== undefined;
    const etabOptions = etablissements
      .map(
        (e) =>
          `<option value="${e.id}" ${e.id === utilisateur.etablissementId ? "selected" : ""}>${e.nom}</option>`
      )
      .join("");

    const rolesWithEtab = ["enseignant", "directeur"];
    const initialShowEtab = rolesWithEtab.includes(utilisateur.role);

    const { value: formValues } = await Swal.fire({
      title: modeReinitialisation ? "Réinitialiser le mot de passe" : "Modifier le compte",
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
          ${
            modeReinitialisation
              ? `<div class="swal-field">
            <label class="swal-label" for="swal-password">Mot de passe temporaire</label>
            <input id="swal-password" class="swal-input" type="text" autocomplete="off" spellcheck="false"
              style="font-family:monospace;letter-spacing:0.08em" value="${echapperHtml(motDePasseTemporaire)}" />
          </div>`
              : ""
          }
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: modeReinitialisation ? "Réinitialiser" : "Enregistrer",
      cancelButtonText: "Annuler",
      confirmButtonColor: "#F97316",
      cancelButtonColor: "#0A0A0A",
      preConfirm: () => {
        const password = modeReinitialisation
          ? (document.getElementById("swal-password") as HTMLInputElement).value
          : undefined;
        if (password !== undefined && password.length < 8) {
          Swal.showValidationMessage("Le mot de passe doit contenir au moins 8 caractères.");
          return false;
        }
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
        return { prenom, nom, email, role, etablissementId, password };
      },
    });

    if (!formValues) return null;

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
        return null;
      }
      if (!res.ok) {
        void Toast.fire({ icon: "error", title: data.error ?? "Impossible de modifier le compte." });
        return null;
      }

      setUtilisateurs((current) =>
        current.map((u) => (u.id === utilisateur.id ? { ...data } : u))
      );
      if (!modeReinitialisation) void Toast.fire({ icon: "success", title: "Compte modifié." });
      return formValues.password ?? "";
    } catch {
      void Toast.fire({ icon: "error", title: "Erreur réseau. Veuillez réessayer." });
      return null;
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <>
      {demandes.length > 0 && (
        <section
          aria-labelledby="demandes-title"
          className="mb-10 overflow-hidden rounded-2xl border border-red-200 bg-surface shadow-sm"
        >
          <h2 id="demandes-title" className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-5 py-4 text-lg font-bold text-red-900">
            <span aria-hidden="true">🔔</span>
            {demandes.length} demande{demandes.length > 1 ? "s" : ""} de réinitialisation en attente
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-sm">
              <thead>
                <tr className="bg-ink text-surface">
                  <th scope="col" className="px-5 py-3 text-left font-semibold">Email</th>
                  <th scope="col" className="px-5 py-3 text-left font-semibold">Nom</th>
                  <th scope="col" className="px-5 py-3 text-left font-semibold">Date de la demande</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {demandes.map((d, i) => (
                  <tr key={d.id} className={i % 2 === 1 ? "bg-page" : "bg-surface"}>
                    <td className="px-5 py-3 font-medium text-ink">{d.user.email}</td>
                    <td className="px-5 py-3 text-ink-secondary">{d.user.prenom} {d.user.nom}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-ink-secondary">
                      {dateDemandeFmt.format(new Date(d.createdAt))}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        size="sm"
                        disabled={processingId === d.user.id}
                        onClick={() => void handleResetDemande(d)}
                      >
                        Réinitialiser le mot de passe
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
