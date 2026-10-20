import type { Langue } from "@/lib/i18n/langue";
import { NOM_MINISTERE_CHALLENGE, TEXTES } from "@/lib/i18n/textes";

/**
 * Intitulé neutre affiché à côté des armoiries : « République du Bénin »
 * au-dessus du nom de la plateforme et de « Plateforme nationale de suivi
 * scolaire ». La plateforme n'est présentée comme le service d'aucun ministère.
 */
export function BlocIdentite({
  langue,
  variante = "sombre",
  taille = "sm",
}: {
  langue: Langue;
  variante?: "sombre" | "clair";
  taille?: "sm" | "base";
}) {
  const t = TEXTES[langue].commun;
  const sombre = variante === "sombre";
  return (
    <div data-identite="">
      <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${sombre ? "text-surface/60" : "text-ink-secondary"}`}>
        {t.pays}
      </p>
      <p className={`font-bold uppercase tracking-[0.16em] ${taille === "base" ? "text-base" : "text-sm"} ${sombre ? "text-surface" : "text-ink"}`}>
        {t.nomPlateforme}
      </p>
      <p className={`text-xs ${sombre ? "text-surface/50" : "text-ink-secondary"}`}>{t.intitule}</p>
    </div>
  );
}

/**
 * Mention du challenge dans lequel le projet a été sélectionné. Le nom du
 * ministère reste en français (pas de forme anglaise officielle) : il est
 * balisé lang="fr" pour être prononcé en français par les lecteurs d'écran.
 */
export function MentionChallenge({ langue, className = "" }: { langue: Langue; className?: string }) {
  return (
    <p className={className} data-mention-challenge="">
      {TEXTES[langue].commun.mentionChallenge} <span lang="fr">{NOM_MINISTERE_CHALLENGE}</span>
    </p>
  );
}
