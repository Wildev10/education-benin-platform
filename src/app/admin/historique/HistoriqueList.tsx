"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, roleVariant } from "@/components/ui/Badge";
import { ACTION_TYPES, type ActionType } from "@/lib/audit-types";
import type { EntreeHistorique } from "@/lib/historique";

const actionLabels: Record<ActionType, string> = {
  NOTE_CREEE: "Note créée",
  ABSENCE_CREEE: "Absence créée",
  ABSENCE_SUPPRIMEE: "Absence supprimée",
  ALERTE_TRAITEE: "Alerte traitée",
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

export default function HistoriqueList({
  initialLogs,
  utilisateurs,
}: {
  initialLogs: EntreeHistorique[];
  utilisateurs: { id: string; nom: string; prenom: string }[];
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (userId) params.set("userId", userId);

    setLoading(true);
    setError("");
    fetch(`/api/admin/historique?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setLogs(await res.json());
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Impossible de charger l'historique.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [action, userId]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filtre-action" className="text-sm font-semibold text-ink">Type d&apos;action</label>
          <select id="filtre-action" value={action} onChange={(e) => setAction(e.target.value)} className={selectCls}>
            <option value="">Toutes les actions</option>
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>{actionLabels[a]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filtre-utilisateur" className="text-sm font-semibold text-ink">Utilisateur</label>
          <select id="filtre-utilisateur" value={userId} onChange={(e) => setUserId(e.target.value)} className={selectCls}>
            <option value="">Tous les utilisateurs</option>
            {utilisateurs.map((u) => (
              <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-medium text-red-800">
          {error}
        </p>
      )}

      <div
        className={`mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-opacity ${loading ? "opacity-60" : ""}`}
        aria-busy={loading}
      >
        <div className="overflow-x-auto">
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
        </div>
      </div>
    </>
  );
}
