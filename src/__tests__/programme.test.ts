import { describe, expect, it } from "vitest";
import { MATIERES, comparerMatieres, matieresDuNiveau } from "@/lib/programme";

describe("Matières par classe", () => {
  it("6ème : tronc commun, sans deuxième langue ni Philosophie", () => {
    expect(matieresDuNiveau("6ème")).toEqual(["Mathématiques", "PCT", "SVT", "Français", "Anglais", "Histoire-Géographie", "EPS"]);
  });

  it("deuxième langue dès la 4ème, Philosophie en Première et Terminale, Économie en série B", () => {
    expect(matieresDuNiveau("4ème")).toEqual(expect.arrayContaining(["Espagnol", "Allemand"]));
    expect(matieresDuNiveau("Seconde B")).toContain("Économie");
    expect(matieresDuNiveau("Seconde B")).not.toContain("Philosophie");
    expect(matieresDuNiveau("Terminale A1")).toContain("Philosophie");
    expect(matieresDuNiveau("Terminale A1")).not.toContain("Économie");
    expect(matieresDuNiveau("Première B")).toEqual(expect.arrayContaining(["Philosophie", "Économie"]));
  });

  it("classe inconnue ou absente : toutes les matières", () => {
    expect(matieresDuNiveau(undefined)).toEqual(MATIERES);
    expect(matieresDuNiveau("CM2")).toEqual(MATIERES);
  });

  it("tri : ordre du programme, anciennes matières à la fin par ordre alphabétique", () => {
    expect(["EPS", "Physique-Chimie", "Mathématiques", "Histoire-Géo", "PCT"].sort(comparerMatieres)).toEqual([
      "Mathématiques", "PCT", "EPS", "Histoire-Géo", "Physique-Chimie",
    ]);
  });
});
