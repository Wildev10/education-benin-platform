import { FUSEAU_BENIN, jourIsoAuBenin } from "@/lib/dates";

// Ligne « Mis à jour à 10 h 28 · il y a 5 min » des tableaux de bord.

const ESPACE_INSECABLE = " ";
const MINUTE = 60 * 1000;
const HEURE = 60 * MINUTE;

const formatHeure = new Intl.DateTimeFormat("fr-FR", {
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: FUSEAU_BENIN,
});
const formatJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: FUSEAU_BENIN });

/** Heure au Bénin, à la française : « 10 h 28 », « 9 h 05 ». */
export function formaterHeure(date: Date): string {
  const parties = formatHeure.formatToParts(date);
  const heure = parties.find((p) => p.type === "hour")?.value ?? "";
  const minute = parties.find((p) => p.type === "minute")?.value ?? "";
  return `${Number(heure)}${ESPACE_INSECABLE}h${ESPACE_INSECABLE}${minute}`;
}

/** « à 10 h 28 » le jour même (au Bénin), sinon « le 21 octobre à 10 h 28 ». */
export function libelleMiseAJour(date: Date, maintenant: Date): string {
  const heure = `à ${formaterHeure(date)}`;
  return jourIsoAuBenin(date) === jourIsoAuBenin(maintenant) ? heure : `le ${formatJour.format(date)} ${heure}`;
}

/** Ancienneté des données : « à l'instant », « il y a 5 min », « il y a 2 h », « il y a 3 jours ». */
export function formaterIlYA(date: Date, maintenant: Date): string {
  const ecart = Math.max(0, maintenant.getTime() - date.getTime());
  if (ecart < MINUTE) return "à l'instant";
  if (ecart < HEURE) return `il y a ${Math.floor(ecart / MINUTE)}${ESPACE_INSECABLE}min`;
  if (ecart < 24 * HEURE) return `il y a ${Math.floor(ecart / HEURE)}${ESPACE_INSECABLE}h`;
  const jours = Math.floor(ecart / (24 * HEURE));
  return `il y a ${jours}${ESPACE_INSECABLE}jour${jours > 1 ? "s" : ""}`;
}
