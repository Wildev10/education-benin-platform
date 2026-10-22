import { describe, expect, it } from "vitest";
import { formaterHeure, formaterIlYA, libelleMiseAJour } from "@/lib/mise-a-jour";
import { initiales, nomComplet } from "@/lib/nom-utilisateur";

const NBSP = " ";
// 22 octobre 2026, 10 h 28 au Bénin (UTC+1)
const DONNEES = new Date("2026-10-22T09:28:00Z");

describe("Ligne « Mis à jour » des tableaux de bord", () => {
  it("heure au Bénin à la française, sans zéro devant l'heure", () => {
    expect(formaterHeure(DONNEES)).toBe(`10${NBSP}h${NBSP}28`);
    expect(formaterHeure(new Date("2026-10-22T08:05:00Z"))).toBe(`9${NBSP}h${NBSP}05`);
    expect(formaterHeure(new Date("2026-10-22T23:30:00Z"))).toBe(`0${NBSP}h${NBSP}30`);
  });

  it("le jour n'est précisé que s'il n'est plus le même au Bénin", () => {
    expect(libelleMiseAJour(DONNEES, new Date("2026-10-22T20:00:00Z"))).toBe(`à 10${NBSP}h${NBSP}28`);
    // 23 h 30 UTC : déjà le 23 octobre au Bénin
    expect(libelleMiseAJour(DONNEES, new Date("2026-10-22T23:30:00Z"))).toBe(`le 22 octobre à 10${NBSP}h${NBSP}28`);
  });

  it("ancienneté relative", () => {
    const apres = (ms: number) => new Date(DONNEES.getTime() + ms);
    expect(formaterIlYA(DONNEES, apres(30_000))).toBe("à l'instant");
    expect(formaterIlYA(DONNEES, apres(-5_000))).toBe("à l'instant");
    expect(formaterIlYA(DONNEES, apres(5 * 60_000 + 10_000))).toBe(`il y a 5${NBSP}min`);
    expect(formaterIlYA(DONNEES, apres(2 * 3_600_000))).toBe(`il y a 2${NBSP}h`);
    expect(formaterIlYA(DONNEES, apres(24 * 3_600_000))).toBe(`il y a 1${NBSP}jour`);
    expect(formaterIlYA(DONNEES, apres(3 * 24 * 3_600_000))).toBe(`il y a 3${NBSP}jours`);
  });
});

describe("Nom et initiales de l'en-tête", () => {
  it("prénom puis nom", () => {
    expect(nomComplet("Arsène", "Kpadonou")).toBe("Arsène Kpadonou");
    expect(nomComplet("  ", "Kpadonou")).toBe("Kpadonou");
  });

  it("initiales du premier et du dernier mot", () => {
    expect(initiales("Arsène Kpadonou")).toBe("AK");
    expect(initiales("Jean Marc Dossou")).toBe("JD");
    expect(initiales("Marie-Claire Houngbédji")).toBe("MH");
    expect(initiales("élodie agossou")).toBe("ÉA");
    expect(initiales("Kpadonou")).toBe("K");
    expect(initiales("")).toBe("");
  });
});
