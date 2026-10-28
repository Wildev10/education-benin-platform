"use client";

import { FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useHorsLigne } from "@/components/pwa/PwaProvider";
import { TITRE_HORS_LIGNE } from "@/components/pwa/BandeauHorsLigne";
import { redirigerVersConnexion } from "@/lib/session-expiree";
import { Toast } from "@/lib/swal";
import {
  ACTIONS_SUIVI,
  COMMENTAIRE_MAX,
  COMMENTAIRE_MIN,
  LIBELLES_ACTION,
  statutSuivi,
  type EtapeSuivi,
  type Transition,
} from "@/lib/suivi-alertes";

type MiseAJour = { statut: string; suiviDepuis: string | null; suivis: EtapeSuivi[] };

const TITRES: Record<Transition, string> = {
  suivre: "Ajouter une action de suivi",
  resoudre: "Résoudre l'alerte",
  rouvrir: "Rouvrir l'alerte",
};

const ENREGISTRER: Record<Transition, string> = {
  suivre: "Enregistrer l'action",
  resoudre: "Résoudre l'alerte",
  rouvrir: "Rouvrir l'alerte",
};

const SUCCES: Record<Transition, string> = {
  suivre: "Action enregistrée : alerte en cours de suivi.",
  resoudre: "Alerte résolue.",
  rouvrir: "Alerte rouverte.",
};

const champCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark";

/**
 * Étapes du suivi d'une alerte (POST /api/alertes/[id]/suivis, qui vérifie le
 * rôle et l'établissement) : une action et un commentaire à chaque étape.
 */
export function FormulaireSuivi({
  alerte,
  onMiseAJour,
}: {
  alerte: { id: string; statut: string; suiviDepuis: string | null };
  onMiseAJour: (maj: MiseAJour) => void;
}) {
  const id = useId();
  const horsLigne = useHorsLigne();
  const [transition, setTransition] = useState<Transition | null>(null);
  const [action, setAction] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const resolue = statutSuivi(alerte) === "resolue";

  function ouvrir(t: Transition) {
    setTransition(t);
    setAction("");
    setCommentaire("");
    setErreur("");
  }

  async function enregistrer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transition) return;
    if (transition !== "rouvrir" && !action) {
      setErreur("Choisissez l'action menée.");
      return;
    }
    if (commentaire.trim().length < COMMENTAIRE_MIN) {
      setErreur(`Le commentaire est obligatoire (${COMMENTAIRE_MIN} caractères au moins).`);
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      const response = await fetch(`/api/alertes/${alerte.id}/suivis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transition, action, commentaire }),
      });
      if (response.status === 401) {
        redirigerVersConnexion();
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Impossible d'enregistrer le suivi.");
      onMiseAJour({
        statut: data.statut,
        suiviDepuis: data.suiviDepuis,
        suivis: data.suivis.map((e: EtapeSuivi) => ({ ...e, createdAt: new Date(e.createdAt).toISOString() })),
      });
      void Toast.fire({ icon: "success", title: SUCCES[transition] });
      setTransition(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur lors de l'enregistrement.");
    } finally {
      setEnvoi(false);
    }
  }

  const titreHorsLigne = horsLigne ? `${TITRE_HORS_LIGNE} : le suivi reprendra avec la connexion` : undefined;

  if (!transition) {
    return (
      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
        {resolue ? (
          <Button variant="outline" size="sm" disabled={horsLigne} title={titreHorsLigne} onClick={() => ouvrir("rouvrir")}>
            Rouvrir l&apos;alerte
          </Button>
        ) : (
          <>
            <Button variant="primary" size="sm" disabled={horsLigne} title={titreHorsLigne} onClick={() => ouvrir("suivre")}>
              Ajouter une action
            </Button>
            <Button variant="outline" size="sm" disabled={horsLigne} title={titreHorsLigne} onClick={() => ouvrir("resoudre")}>
              Résoudre l&apos;alerte
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={enregistrer}
      aria-labelledby={`${id}-titre`}
      data-formulaire-suivi={transition}
      className="mt-5 space-y-4 border-t border-border pt-5"
      noValidate
    >
      <h3 id={`${id}-titre`} className="font-semibold text-ink">{TITRES[transition]}</h3>

      {transition !== "rouvrir" && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Action menée</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ACTIONS_SUIVI.map((a) => (
              <label
                key={a}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm text-ink has-checked:border-brand-dark has-checked:bg-brand-light"
              >
                <input
                  type="radio"
                  name={`${id}-action`}
                  value={a}
                  checked={action === a}
                  onChange={() => setAction(a)}
                  className="h-4 w-4 accent-brand-dark"
                />
                {LIBELLES_ACTION[a]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <label htmlFor={`${id}-commentaire`} className="mb-1.5 block text-sm font-semibold text-ink">
          {transition === "resoudre" ? "Commentaire de clôture" : transition === "rouvrir" ? "Motif de la réouverture" : "Commentaire"}
        </label>
        <textarea
          id={`${id}-commentaire`}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          maxLength={COMMENTAIRE_MAX}
          rows={3}
          required
          aria-describedby={`${id}-aide`}
          className={champCls}
        />
        <p id={`${id}-aide`} className="mt-1 text-sm text-ink-secondary">
          Obligatoire, {COMMENTAIRE_MIN} caractères au moins ({commentaire.trim().length}/{COMMENTAIRE_MAX}).
        </p>
      </div>

      {erreur && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {erreur}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={envoi || horsLigne} title={titreHorsLigne}>
          {envoi ? "Enregistrement…" : ENREGISTRER[transition]}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={envoi} onClick={() => setTransition(null)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
