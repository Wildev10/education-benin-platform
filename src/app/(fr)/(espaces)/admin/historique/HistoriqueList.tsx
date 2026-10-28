"use client";

import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Badge, roleVariant } from "@/components/ui/Badge";
import { ACTION_TYPES, type ActionType } from "@/lib/audit-types";
import { filtresHistoriqueVersParams, type FiltresHistorique } from "@/lib/filtres-historique";
import type { EntreeHistorique } from "@/lib/historique";
import { urlListe, type TaillePage } from "@/lib/pagination";
import { CadreDefilant } from "@/components/ui/CadreDefilant";

const actionLabels: Record<ActionType, string> = {
  NOTE_CREEE: "Note créée",
  ABSENCE_CREEE: "Absence créée",
  ABSENCE_SUPPRIMEE: "Absence supprimée",
  ALERTE_TRAITEE: "Alerte traitée",
  ALERTE_SUIVIE: "Alerte suivie",
  ALERTE_RESOLUE: "Alerte résolue",
  ALERTE_ROUVERTE: "Alerte rouverte",
  UTILISATEUR_CREE: "Compte créé",
  UTILISATEUR_MODIFIE: "Compte modifié",
  UTILISATEUR_SUPPRIME: "Compte supprimé",
  NOTES_IMPORTEES: "Notes importées",
  PROFIL_MODIFIE: "Profil modifié",
  MOT_DE_PASSE_CHANGE: "Mot de passe changé",
};

const actionCls: Record<ActionType, string> = {
  NOTE_CREEE: "border-emerald-300 bg-emerald-50 text-emerald-800",
  ABSENCE_CREEE: "border-blue-300 bg-blue-50 text-blue-800",
  ABSENCE_SUPPRIMEE: "border-blue-300 bg-blue-50 text-blue-800",
  ALERTE_TRAITEE: "border-orange-300 bg-orange-50 text-orange-800",
  ALERTE_SUIVIE: "border-orange-300 bg-orange-50 text-orange-800",
  ALERTE_RESOLUE: "border-orange-300 bg-orange-50 text-orange-800",
  ALERTE_ROUVERTE: "border-orange-300 bg-orange-50 text-orange-800",
  UTILISATEUR_CREE: "border-purple-300 bg-purple-50 text-purple-800",
  UTILISATEUR_MODIFIE: "border-purple-300 bg-purple-50 text-purple-800",
  UTILISATEUR_SUPPRIME: "border-purple-300 bg-purple-50 text-purple-800",
  NOTES_IMPORTEES: "border-indigo-300 bg-indigo-50 text-indigo-800",
  PROFIL_MODIFIE: "border-border bg-page text-ink-secondary",
  MOT_DE_PASSE_CHANGE: "border-border bg-page text-ink-secondary",
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Porto-Novo" });
const heureFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Porto-Novo" });

function formatDateHeure(iso: string) {
  const d = new Date(iso);
  return `${dateFmt.format(d)} à ${heureFmt.format(d).replace(":", "h")}`;
}

const selectCls =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark";

/**
 * Filtres et tableau du journal. Les filtres sont gardés dans l'URL et la page
 * est rendue côté serveur ; changer un filtre revient à la page 1.
 */
export default function HistoriqueList({
  logs,
  filtres,
  taille,
  utilisateurs,
  children,
}: {
  logs: EntreeHistorique[];
  filtres: FiltresHistorique;
  taille: TaillePage;
  utilisateurs: { id: string; nom: string; prenom: string }[];
  /** Pagination, affichée sous le tableau */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, startTransition] = useTransition();
  const [courants, setCourants] = useOptimistic(filtres);
  const action = courants.action ?? "";
  const userId = courants.userId ?? "";

  function appliquer(partiel: FiltresHistorique) {
    const suivants = { ...courants, ...partiel };
    startTransition(() => {
      setCourants(suivants);
      router.push(urlListe(pathname, filtresHistoriqueVersParams(suivants), taille), { scroll: false });
    });
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filtre-action" className="text-sm font-semibold text-ink">Type d&apos;action</label>
          <select id="filtre-action" value={action} onChange={(e) => appliquer({ action: e.target.value || undefined })} className={selectCls}>
            <option value="">Toutes les actions</option>
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>{actionLabels[a]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filtre-utilisateur" className="text-sm font-semibold text-ink">Utilisateur</label>
          <select id="filtre-utilisateur" value={userId} onChange={(e) => appliquer({ userId: e.target.value || undefined })} className={selectCls}>
            <option value="">Tous les utilisateurs</option>
            {utilisateurs.map((u) => (
              <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div
        className={`mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-opacity ${loading ? "opacity-60" : ""}`}
        aria-busy={loading}
      >
        <CadreDefilant libelle="Historique des actions">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-ink text-surface">
                <th scope="col" className="px-5 py-4 text-left font-semibold">Date</th>
                <th scope="col" className="px-5 py-4 text-left font-semibold">Utilisateur</th>
                <th scope="col" className="px-5 py-4 text-left font-semibold">Action</th>
                <th scope="col" className="px-5 py-4 text-left font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log, i) => (
                <tr key={log.id} className={i % 2 === 1 ? "bg-page" : "bg-surface"}>
                  <td className="whitespace-nowrap px-5 py-4 text-ink-secondary">{formatDateHeure(log.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{log.user.prenom} {log.user.nom}</span>
                      <Badge variant={roleVariant(log.user.role)} />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        actionCls[log.action as ActionType] ?? "border-border bg-page text-ink-secondary"
                      }`}
                    >
                      {actionLabels[log.action as ActionType] ?? log.action}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink">{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <p className="px-5 py-8 text-center text-ink-secondary">Aucune action enregistrée.</p>
          )}
        </CadreDefilant>
      </div>
      {children}
    </>
  );
}
