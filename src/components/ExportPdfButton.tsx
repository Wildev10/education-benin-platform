"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/lib/swal";
import { useHorsLigne } from "@/components/pwa/PwaProvider";
import { TITRE_HORS_LIGNE } from "@/components/pwa/BandeauHorsLigne";

function nomFichier(disposition: string | null, defaut: string) {
  return disposition?.match(/filename="([^"]+)"/)?.[1] ?? defaut;
}

const FORMATS = {
  pdf: { icone: "📄", nom: "PDF" },
  excel: { icone: "📊", nom: "fichier Excel" },
} as const;

type ProprietesExport = {
  href: string;
  label: string;
  fichierParDefaut: string;
  /** Libellé complet pour les lecteurs d'écran quand le texte visible est court */
  ariaLabel?: string;
};

/** Télécharge un export généré côté serveur (PDF ou Excel). Indisponible hors ligne. */
function BoutonExport({
  href,
  label,
  fichierParDefaut,
  ariaLabel,
  format,
}: ProprietesExport & { format: keyof typeof FORMATS }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const horsLigne = useHorsLigne();
  const { icone, nom } = FORMATS[format];

  async function telecharger() {
    setLoading(true);
    try {
      const response = await fetch(href);
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? `Impossible de générer le ${nom}.`);
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
    <Button
      variant="outline"
      disabled={loading || horsLigne}
      title={horsLigne ? TITRE_HORS_LIGNE : undefined}
      aria-busy={loading}
      aria-label={ariaLabel}
      onClick={() => void telecharger()}
      className="shrink-0"
    >
      <span aria-hidden="true">{icone}</span> {loading ? "Génération..." : label}
    </Button>
  );
}

export function ExportPdfButton(props: ProprietesExport) {
  return <BoutonExport {...props} format="pdf" />;
}

export function ExportExcelButton({ label = "Excel", ...props }: Omit<ProprietesExport, "label"> & { label?: string }) {
  return <BoutonExport {...props} label={label} format="excel" />;
}
