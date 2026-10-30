import { FUSEAU_BENIN } from "@/lib/dates";
import { LIBELLES_ACTION, LIBELLES_MOTIF, LIBELLES_STATUT_SUIVI, type EtapeSuivi, type StatutSuivi } from "@/lib/suivi-alertes";

const dateHeure = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: FUSEAU_BENIN,
});

const libelleStatut = (statut: string) => LIBELLES_STATUT_SUIVI[statut as StatutSuivi] ?? statut;

/** Historique du suivi d'une alerte : action, auteur, date et commentaire de chaque étape. */
export function HistoriqueSuivi({ etapes }: { etapes: EtapeSuivi[] }) {
  if (etapes.length === 0) {
    return <p className="mt-5 text-sm text-ink-secondary">Aucune action de suivi pour l&apos;instant.</p>;
  }
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-secondary">Historique du suivi</h3>
      <ol data-historique-suivi className="mt-3 space-y-3 border-l-2 border-border pl-4">
        {etapes.map((etape) => (
          <li key={etape.id} data-etape={etape.action}>
            <p className="font-semibold text-ink">
              {LIBELLES_ACTION[etape.action] ?? etape.action}
              {etape.motifCloture && <> : {LIBELLES_MOTIF[etape.motifCloture] ?? etape.motifCloture}</>}
              {etape.responsableNom && <> {etape.action === "confie" ? "à" : "· responsable :"} {etape.responsableNom}</>}
              {etape.statutAvant !== etape.statutApres && (
                <span className="font-normal text-ink-secondary">
                  {" "}· {libelleStatut(etape.statutAvant)}
                  <span aria-hidden="true"> → </span>
                  <span className="sr-only"> puis </span>
                  {libelleStatut(etape.statutApres)}
                </span>
              )}
            </p>
            <p className="text-sm text-ink-secondary">
              {etape.auteurNom} · <time dateTime={etape.createdAt}>{dateHeure.format(new Date(etape.createdAt))}</time>
            </p>
            {etape.commentaire && <p className="mt-1 whitespace-pre-line break-words text-sm text-ink">{etape.commentaire}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
