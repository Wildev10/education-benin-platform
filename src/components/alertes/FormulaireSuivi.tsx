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
  LIBELLES_MOTIF,
  MOTIFS_CLOTURE,
  statutSuivi,
  type EtapeSuivi,
  type Transition,
} from "@/lib/suivi-alertes";

/** Enseignant ou directeur de l'établissement de l'élève (liste calculée côté serveur). */
export type Candidat = { id: string; nom: string; role: string };

export type MiseAJourSuivi = {
  statut: string;
  suiviDepuis: string | null;
  motifCloture: string | null;
  responsable: { id: string; nom: string } | null;
  suivis: EtapeSuivi[];
};

const TITRES: Record<Transition, string> = {
  suivre: "Ajouter une action de suivi",
  resoudre: "Clôturer l'alerte",
  rouvrir: "Rouvrir l'alerte",
  confier: "Confier le suivi",
};

const ENREGISTRER: Record<Transition, string> = {
  suivre: "Enregistrer l'action",
  resoudre: "Clôturer l'alerte",
  rouvrir: "Rouvrir l'alerte",
  confier: "Confier le suivi",
};

const SUCCES: Record<Transition, string> = {
  suivre: "Action enregistrée : alerte en cours de suivi.",
  resoudre: "Alerte clôturée.",
  rouvrir: "Alerte rouverte.",
  confier: "Suivi confié.",
};

const champCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-ink transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark";
const choixCls =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm text-ink has-checked:border-brand-dark has-checked:bg-brand-light";

const libelleCandidat = (c: Candidat, moi: string | undefined) =>
  `${c.nom}${c.role === "directeur" ? " (direction)" : ""}${c.id === moi ? " (vous)" : ""}`;

/**
 * Étapes du suivi d'une alerte (POST /api/alertes/[id]/suivis, qui vérifie le
 * rôle, l'établissement et le responsable choisi) :
 * - action : action et commentaire obligatoires, responsable à désigner s'il n'y en a pas ;
 * - clôture : motif en un clic, commentaire facultatif sauf pour « Autre » ;
 * - réouverture : commentaire obligatoire ;
 * - changement de responsable : commentaire facultatif.
 */
export function FormulaireSuivi({
  alerte,
  candidats,
  utilisateurId,
  onMiseAJour,
}: {
  alerte: { id: string; statut: string; suiviDepuis: string | null; responsable: { id: string; nom: string } | null };
  candidats: Candidat[];
  /** Compte connecté : responsable proposé par défaut */
  utilisateurId?: string;
  onMiseAJour: (maj: MiseAJourSuivi) => void;
}) {
  const id = useId();
  const horsLigne = useHorsLigne();
  const [transition, setTransition] = useState<Transition | null>(null);
  const [action, setAction] = useState("");
  const [motif, setMotif] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const statut = statutSuivi(alerte);
  const responsableActuel = alerte.responsable?.id ?? null;

  // Responsable proposé dans le formulaire « action » : seulement s'il n'y en a pas encore
  const designer = transition === "suivre" && !responsableActuel;
  const autresCandidats = candidats.filter((c) => c.id !== responsableActuel);
  const commentaireObligatoire = transition === "suivre" || transition === "rouvrir" || (transition === "resoudre" && motif === "autre");

  function ouvrir(t: Transition) {
    setTransition(t);
    setAction("");
    setMotif("");
    setCommentaire("");
    setErreur("");
    // Par défaut : la personne qui fait l'action (si elle peut être responsable)
    const parDefaut = candidats.some((c) => c.id === utilisateurId) ? utilisateurId! : candidats[0]?.id ?? "";
    setResponsableId(t === "confier" ? autresCandidats[0]?.id ?? "" : parDefaut);
  }

  async function enregistrer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transition) return;
    if (transition === "suivre" && !action) return setErreur("Choisissez l'action menée.");
    if (transition === "resoudre" && !motif) return setErreur("Choisissez le motif de clôture.");
    if (transition === "confier" && !responsableId) return setErreur("Choisissez la personne à qui confier le suivi.");
    if (commentaireObligatoire && commentaire.trim().length < COMMENTAIRE_MIN) {
      return setErreur(
        transition === "resoudre"
          ? `Pour le motif « Autre », le commentaire est obligatoire (${COMMENTAIRE_MIN} caractères au moins).`
          : `Le commentaire est obligatoire (${COMMENTAIRE_MIN} caractères au moins).`
      );
    }
    setEnvoi(true);
    setErreur("");
    try {
      const response = await fetch(`/api/alertes/${alerte.id}/suivis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transition,
          commentaire,
          ...(transition === "suivre" ? { action } : {}),
          ...(transition === "resoudre" ? { motifCloture: motif } : {}),
          ...(transition === "confier" || designer ? { responsableId } : {}),
        }),
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
        motifCloture: data.motifCloture,
        responsable: data.responsable
          ? { id: data.responsable.id, nom: `${data.responsable.prenom} ${data.responsable.nom}`.trim() }
          : null,
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
        {statut === "resolue" ? (
          <Button variant="outline" size="sm" disabled={horsLigne} title={titreHorsLigne} onClick={() => ouvrir("rouvrir")}>
            Rouvrir l&apos;alerte
          </Button>
        ) : (
          <>
            <Button variant="primary" size="sm" disabled={horsLigne} title={titreHorsLigne} onClick={() => ouvrir("suivre")}>
              Ajouter une action
            </Button>
            {statut === "en_suivi" && autresCandidats.length > 0 && (
              <Button variant="outline" size="sm" disabled={horsLigne} title={titreHorsLigne} onClick={() => ouvrir("confier")}>
                {responsableActuel ? "Changer le responsable" : "Désigner un responsable"}
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={horsLigne} title={titreHorsLigne} onClick={() => ouvrir("resoudre")}>
              Clôturer l&apos;alerte
            </Button>
          </>
        )}
      </div>
    );
  }

  const choixResponsable = (liste: Candidat[], legende: string) => (
    <div>
      <label htmlFor={`${id}-responsable`} className="mb-1.5 block text-sm font-semibold text-ink">{legende}</label>
      <select id={`${id}-responsable`} value={responsableId} onChange={(e) => setResponsableId(e.target.value)} className={champCls}>
        {liste.map((c) => (
          <option key={c.id} value={c.id}>{libelleCandidat(c, utilisateurId)}</option>
        ))}
      </select>
    </div>
  );

  return (
    <form
      onSubmit={enregistrer}
      aria-labelledby={`${id}-titre`}
      data-formulaire-suivi={transition}
      className="mt-5 space-y-4 border-t border-border pt-5"
      noValidate
    >
      <h3 id={`${id}-titre`} className="font-semibold text-ink">
        {transition === "confier" && !responsableActuel ? "Désigner un responsable" : TITRES[transition]}
      </h3>

      {transition === "suivre" && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Action menée</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ACTIONS_SUIVI.map((a) => (
              <label key={a} className={choixCls}>
                <input type="radio" name={`${id}-action`} value={a} checked={action === a} onChange={() => setAction(a)} className="h-4 w-4 accent-brand-dark" />
                {LIBELLES_ACTION[a]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {transition === "resoudre" && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Motif de clôture</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {MOTIFS_CLOTURE.map((m) => (
              <label key={m} className={choixCls}>
                <input type="radio" name={`${id}-motif`} value={m} checked={motif === m} onChange={() => setMotif(m)} className="h-4 w-4 accent-brand-dark" />
                {LIBELLES_MOTIF[m]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {designer && candidats.length > 0 && choixResponsable(candidats, "Responsable du suivi")}
      {transition === "confier" && choixResponsable(autresCandidats, "Confier le suivi à")}

      <div>
        <label htmlFor={`${id}-commentaire`} className="mb-1.5 block text-sm font-semibold text-ink">
          {transition === "resoudre" ? "Commentaire de clôture" : transition === "rouvrir" ? "Motif de la réouverture" : "Commentaire"}
          {!commentaireObligatoire && <span className="font-normal text-ink-secondary"> (facultatif)</span>}
        </label>
        <textarea
          id={`${id}-commentaire`}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          maxLength={COMMENTAIRE_MAX}
          rows={3}
          required={commentaireObligatoire}
          aria-describedby={`${id}-aide`}
          className={champCls}
        />
        <p id={`${id}-aide`} className="mt-1 text-sm text-ink-secondary">
          {commentaireObligatoire ? `Obligatoire, ${COMMENTAIRE_MIN} caractères au moins` : "Facultatif"} ({commentaire.trim().length}/{COMMENTAIRE_MAX}).
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
