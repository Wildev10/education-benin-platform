"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Etablissement = {
  id: string;
  nom: string;
};

type Etudiant = {
  id: string;
  nom: string;
  prenom: string;
  niveau: string;
  etablissement: Etablissement;
};

type ActiveAlert = {
  etudiant: { id: string };
};

const niveaux = ["Seconde C", "Première D", "Terminale D"];

export default function StudentDirectory({
  etablissements,
  detailBasePath = "/enseignant/etudiants",
  showActiveAlerts = false,
}: {
  etablissements: Etablissement[];
  detailBasePath?: string;
  showActiveAlerts?: boolean;
}) {
  const [etudiants, setEtudiants] = useState<Etudiant[]>([]);
  const [activeAlertStudentIds, setActiveAlertStudentIds] = useState<Set<string>>(new Set());
  const [etablissementId, setEtablissementId] = useState("");
  const [niveau, setNiveau] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadStudents() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (etablissementId) params.set("etablissementId", etablissementId);
      if (niveau) params.set("niveau", niveau);

      try {
        const requests = [
          fetch(`/api/etudiants?${params.toString()}`, { signal: controller.signal }),
        ];
        if (showActiveAlerts) {
          requests.push(fetch("/api/alertes?statut=active", { signal: controller.signal }));
        }

        const responses = await Promise.all(requests);
        if (responses.some((response) => response.status === 401)) {
          window.location.assign("/login");
          return;
        }
        const studentData = await responses[0].json();
        if (!responses[0].ok) throw new Error(studentData.error ?? "Erreur de chargement");

        setEtudiants(studentData);
        if (showActiveAlerts) {
          const alertData = await responses[1].json() as ActiveAlert[];
          if (!responses[1].ok) throw new Error("Impossible de charger les alertes actives.");
          setActiveAlertStudentIds(new Set(alertData.map((alert) => alert.etudiant.id)));
        }
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }
        setError("Impossible de charger la liste des étudiants.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadStudents();
    return () => controller.abort();
  }, [etablissementId, niveau, showActiveAlerts]);

  return (
    <section aria-labelledby="liste-etudiants" className="mt-8">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
            Suivi pédagogique
          </p>
          <h2 id="liste-etudiants" className="mt-1 text-2xl font-semibold text-ink">
            Étudiants
          </h2>
        </div>
        <p className="text-sm text-ink-secondary" aria-live="polite">
          {loading ? "Chargement…" : `${etudiants.length} étudiant${etudiants.length > 1 ? "s" : ""}`}
        </p>
      </div>

      <div className="grid gap-4 border-b border-border py-5 sm:grid-cols-2">
        <div>
          <label htmlFor="filter-etablissement" className="mb-2 block text-sm font-semibold text-ink">
            Établissement
          </label>
          <select
            id="filter-etablissement"
            value={etablissementId}
            onChange={(event) => setEtablissementId(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark"
          >
            <option value="">Tous les établissements</option>
            {etablissements.map((etablissement) => (
              <option key={etablissement.id} value={etablissement.id}>
                {etablissement.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-niveau" className="mb-2 block text-sm font-semibold text-ink">
            Niveau
          </label>
          <select
            id="filter-niveau"
            value={niveau}
            onChange={(event) => setNiveau(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark"
          >
            <option value="">Tous les niveaux</option>
            {niveaux.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-medium text-red-800">
          {error}
        </p>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-left">
            <caption className="sr-only">Liste filtrée des étudiants</caption>
            <thead className="bg-ink text-sm text-surface">
              <tr>
                <th scope="col" className="px-5 py-3.5 font-semibold">Nom</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">Prénom</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">Établissement</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">Niveau</th>
                {showActiveAlerts && <th scope="col" className="px-5 py-3.5 font-semibold">Suivi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {etudiants.map((etudiant, i) => (
                <tr key={etudiant.id} className={`transition hover:bg-brand-light ${i % 2 === 1 ? "bg-page" : "bg-surface"}`}>
                  <td className="px-5 py-4 font-semibold text-ink">
                    <Link href={`${detailBasePath}/${etudiant.id}`} className="hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2">
                      {etudiant.nom}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-ink-secondary">{etudiant.prenom}</td>
                  <td className="px-5 py-4 text-ink-secondary">{etudiant.etablissement.nom}</td>
                  <td className="px-5 py-4 text-ink-secondary">{etudiant.niveau}</td>
                  {showActiveAlerts && (
                    <td className="px-5 py-4">
                      {activeAlertStudentIds.has(etudiant.id) ? (
                        <span className="inline-flex rounded-full border border-red-300 bg-red-50 px-3 py-1 text-sm font-semibold text-red-900">
                          <span aria-hidden="true">⚠ </span>Alerte active
                        </span>
                      ) : (
                        <span className="text-sm text-ink-secondary">Aucune alerte</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && etudiants.length === 0 && (
          <p className="p-8 text-center text-ink-secondary">Aucun étudiant ne correspond à ces filtres.</p>
        )}
      </div>
    </section>
  );
}
