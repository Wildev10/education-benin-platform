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
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">
            Suivi pédagogique
          </p>
          <h2 id="liste-etudiants" className="mt-1 text-2xl font-bold text-slate-950">
            Étudiants
          </h2>
        </div>
        <p className="text-sm text-slate-600" aria-live="polite">
          {loading ? "Chargement..." : `${etudiants.length} étudiant${etudiants.length > 1 ? "s" : ""}`}
        </p>
      </div>

      <div className="grid gap-4 border-b border-slate-200 py-5 sm:grid-cols-2">
        <div>
          <label htmlFor="filter-etablissement" className="mb-2 block text-sm font-semibold text-slate-800">
            Établissement
          </label>
          <select
            id="filter-etablissement"
            value={etablissementId}
            onChange={(event) => setEtablissementId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600"
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
          <label htmlFor="filter-niveau" className="mb-2 block text-sm font-semibold text-slate-800">
            Niveau
          </label>
          <select
            id="filter-niveau"
            value={niveau}
            onChange={(event) => setNiveau(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600"
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

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-left">
            <caption className="sr-only">Liste filtrée des étudiants</caption>
            <thead className="bg-slate-100 text-sm text-slate-700">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Nom</th>
                <th scope="col" className="px-5 py-3 font-semibold">Prénom</th>
                <th scope="col" className="px-5 py-3 font-semibold">Établissement</th>
                <th scope="col" className="px-5 py-3 font-semibold">Niveau</th>
                {showActiveAlerts && <th scope="col" className="px-5 py-3 font-semibold">Suivi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {etudiants.map((etudiant) => (
                <tr key={etudiant.id} className="transition hover:bg-teal-50">
                  <td className="px-5 py-4 font-semibold text-slate-950">
                    <Link href={`${detailBasePath}/${etudiant.id}`} className="focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2">
                      {etudiant.nom}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-slate-800">{etudiant.prenom}</td>
                  <td className="px-5 py-4 text-slate-800">{etudiant.etablissement.nom}</td>
                  <td className="px-5 py-4 text-slate-800">{etudiant.niveau}</td>
                  {showActiveAlerts && (
                    <td className="px-5 py-4">
                      {activeAlertStudentIds.has(etudiant.id) ? (
                        <span className="inline-flex rounded-full border border-red-300 bg-red-50 px-3 py-1 text-sm font-bold text-red-900">
                          Alerte active
                        </span>
                      ) : (
                        <span className="text-sm text-slate-600">Aucune alerte</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && etudiants.length === 0 && (
          <p className="p-8 text-center text-slate-700">Aucun étudiant ne correspond à ces filtres.</p>
        )}
      </div>
    </section>
  );
}
