"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Confirm, Toast } from "@/lib/swal";

/**
 * Bouton « Marquer comme traitée » : confirmation, PATCH /api/alertes/[id]
 * (qui vérifie le rôle et l'établissement côté serveur), puis toast de succès.
 * Sans `onTraitee`, la page est rafraîchie (listes rendues côté serveur).
 */
export function BoutonTraiterAlerte({
  alerteId,
  onTraitee,
}: {
  alerteId: string;
  onTraitee?: () => void;
}) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);

  async function traiter() {
    const result = await Confirm.fire({
      title: "Êtes-vous sûr ?",
      text: "Cette action est irréversible.",
      icon: "warning",
      showCancelButton: true,
    });
    if (!result.isConfirmed) return;

    setEnCours(true);
    try {
      const response = await fetch(`/api/alertes/${alerteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "traitee" }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Impossible de traiter l'alerte.");
      void Toast.fire({ icon: "success", title: "Alerte marquée comme traitée." });
      if (onTraitee) onTraitee();
      else router.refresh();
    } catch (e) {
      void Toast.fire({
        icon: "error",
        title: e instanceof Error ? e.message : "Erreur lors de la mise à jour.",
      });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={enCours} onClick={() => void traiter()} className="shrink-0">
      {enCours ? "Mise à jour…" : "Marquer comme traitée"}
    </Button>
  );
}
