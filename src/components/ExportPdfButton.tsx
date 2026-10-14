"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/lib/swal";

function nomFichier(disposition: string | null, defaut: string) {
  return disposition?.match(/filename="([^"]+)"/)?.[1] ?? defaut;
}

export function ExportPdfButton({
  href,
  label,
  fichierParDefaut,
}: {
  href: string;
  label: string;
  fichierParDefaut: string;
}) {
  const [loading, setLoading] = useState(false);

  async function telecharger() {
    setLoading(true);
    try {
      const response = await fetch(href);
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Impossible de générer le PDF.");
      }
      const url = URL.createObjectURL(await response.blob());
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = nomFichier(response.headers.get("Content-Disposition"), fichierParDefaut);
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      void Toast.fire({ icon: "error", title: e instanceof Error ? e.message : "Erreur lors de l'export." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" disabled={loading} aria-busy={loading} onClick={() => void telecharger()} className="shrink-0">
      <span aria-hidden="true">📄</span> {loading ? "Génération..." : label}
    </Button>
  );
}
