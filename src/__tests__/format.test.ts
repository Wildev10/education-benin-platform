import { describe, expect, it } from "vitest";
import { formaterBaisse, formaterNombre, formaterNote, formaterPourcent } from "@/lib/format";
import { libelleCourt, libellePeriode } from "@/lib/notes-trimestres";

const NBSP = " ";

describe("Formatage unique des nombres (format français)", () => {
  it("virgule décimale, nombre de décimales fixe", () => {
    expect(formaterNombre(12.1)).toBe("12,1");
    expect(formaterNombre(7.8, 2)).toBe("7,80");
    expect(formaterNombre(12.345, 2)).toBe("12,35");
    expect(formaterNombre(299, 0)).toBe("299");
  });

  it("milliers séparés par une espace insécable ordinaire (lisible dans les PDF)", () => {
    expect(formaterNombre(20036, 0)).toBe(`20${NBSP}036`);
  });

  it("note : jusqu'à deux décimales, sans zéro inutile", () => {
    expect(formaterNote(15)).toBe("15");
    expect(formaterNote(12.5)).toBe("12,5");
    expect(formaterNote(12.75)).toBe("12,75");
  });

  it("pourcentage et baisse : espace insécable avant %, vrai signe moins", () => {
    expect(formaterPourcent(8.7)).toBe(`8,7${NBSP}%`);
    expect(formaterBaisse(35)).toBe(`−35,0${NBSP}%`);
  });

  it("jamais de point décimal", () => {
    for (const texte of [formaterNombre(3.14159, 3), formaterNote(9.25), formaterPourcent(12.5), formaterBaisse(0.5)]) {
      expect(texte).not.toMatch(/\d\.\d/);
    }
  });
});

describe("Libellé unique d'une période", () => {
  it("« Trimestre 1 · 2026-2027 » : numéro et année séparés par un point médian", () => {
    expect(libellePeriode("Trimestre 1", "2026-2027")).toBe(`Trimestre${NBSP}1 ·${NBSP}2026-2027`);
  });

  it("une seule coupure possible, avant le point : « Trimestre 3 » puis « · 2025-2026 »", () => {
    const libelle = libellePeriode("Trimestre 3", "2025-2026");
    expect(libelle.split(" ")).toEqual([`Trimestre${NBSP}3`, `·${NBSP}2025-2026`]);
    expect(libelle).not.toMatch(/\d \d/);
  });

  it("libellé court des graphiques : « T1 · 25-26 » sur plusieurs années, « T1 » sinon", () => {
    expect(libelleCourt({ anneeScolaire: "2025-2026", periode: "Trimestre 1" }, true)).toBe(`T1 ·${NBSP}25-26`);
    expect(libelleCourt({ anneeScolaire: "2025-2026", periode: "Trimestre 1" }, false)).toBe("T1");
  });
});
