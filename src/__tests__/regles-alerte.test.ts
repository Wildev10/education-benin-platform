import { describe, expect, it } from "vitest";
import { periodeScolaireAuBenin, periodeScolaireDuJour } from "@/lib/annee-scolaire";
import { messageSaisie, texteComparaison, type AlerteSaisie } from "@/lib/message-saisie";
import { comparerMoyennes, compterAbsencesRecentes } from "@/lib/regles-alerte";

const note = (valeur: number, periode: string, anneeScolaire = "2025-2026") => ({ valeur, periode, anneeScolaire });

// ── Période proposée par défaut ──────────────────────────────────────────────

describe("periodeScolaireDuJour", () => {
  it.each([
    ["2026-09-01", "2026-2027", "Trimestre 1"],
    ["2026-10-21", "2026-2027", "Trimestre 1"],
    ["2026-12-31", "2026-2027", "Trimestre 1"],
    ["2027-01-01", "2026-2027", "Trimestre 2"],
    ["2027-03-31", "2026-2027", "Trimestre 2"],
    ["2027-04-01", "2026-2027", "Trimestre 3"],
    ["2027-08-31", "2026-2027", "Trimestre 3"],
  ])("%s → %s, %s", (jour, anneeScolaire, periode) => {
    expect(periodeScolaireDuJour(jour)).toEqual({ anneeScolaire, periode });
  });

  it("jour du Bénin, pas d'UTC : le 31 août à 23 h 30 UTC est déjà le 1er septembre au Bénin", () => {
    expect(periodeScolaireAuBenin(new Date("2026-08-31T23:30:00Z"))).toEqual({
      anneeScolaire: "2026-2027",
      periode: "Trimestre 1",
    });
  });
});

// ── Comparaison des moyennes ─────────────────────────────────────────────────

describe("comparerMoyennes", () => {
  it("aucune note, ou une seule période : pas encore de période de comparaison", () => {
    expect(comparerMoyennes([]).etat).toBe("sans_periode_precedente");
    expect(comparerMoyennes([note(2, "Trimestre 1"), note(3, "Trimestre 1")]).etat).toBe("sans_periode_precedente");
  });

  it("une seule note dans la période la plus récente : pas de comparaison (2 notes au moins)", () => {
    const res = comparerMoyennes([note(15, "Trimestre 3"), note(0, "Trimestre 1", "2026-2027")]);
    expect(res).toMatchObject({ etat: "notes_insuffisantes", periodeRecente: { periode: "Trimestre 1", anneeScolaire: "2026-2027", noteCount: 1 } });
  });

  it("deux périodes, deux notes : comparée, avec le niveau des règles (−20 % et < 10 → Élevé)", () => {
    const res = comparerMoyennes([note(15, "Trimestre 1"), note(8, "Trimestre 2"), note(9, "Trimestre 2")]);
    expect(res).toMatchObject({ etat: "comparee", niveauRisque: "eleve", periodeAvant: { moyenne: 15 }, periodeRecente: { moyenne: 8.5 } });
  });

  it("change d'année : le trimestre 1 de 2026-2027 suit le trimestre 3 de 2025-2026", () => {
    const res = comparerMoyennes([note(12, "Trimestre 3"), note(14, "Trimestre 1"), note(9, "Trimestre 1", "2026-2027"), note(9, "Trimestre 1", "2026-2027")]);
    expect(res).toMatchObject({ etat: "comparee", periodeAvant: { periode: "Trimestre 3", moyenne: 12 }, niveauRisque: "eleve" });
  });

  it("baisse de 14 % : comparée, sans niveau", () => {
    const res = comparerMoyennes([note(10, "Trimestre 1"), note(8.6, "Trimestre 2"), note(8.6, "Trimestre 2")]);
    expect(res).toMatchObject({ etat: "comparee", niveauRisque: null });
  });
});

describe("compterAbsencesRecentes", () => {
  const abs = (n: number, periode: string, anneeScolaire = "2025-2026") =>
    Array.from({ length: n }, () => ({ periode, anneeScolaire }));

  it("période la plus récente qui a des absences, même si une plus ancienne en a plus", () => {
    expect(compterAbsencesRecentes([...abs(12, "Trimestre 3"), ...abs(5, "Trimestre 1", "2026-2027")])).toEqual({
      periode: "Trimestre 1",
      anneeScolaire: "2026-2027",
      count: 5,
      niveauRisque: "moyen",
    });
  });

  it("aucune absence : null ; 4 absences : pas de niveau", () => {
    expect(compterAbsencesRecentes([])).toBeNull();
    expect(compterAbsencesRecentes(abs(4, "Trimestre 1"))?.niveauRisque).toBeNull();
  });
});

// ── Message après une saisie ─────────────────────────────────────────────────

const eleve = { prenom: "Koffi", nom: "Agossou" };
const alerte = (champs: Partial<AlerteSaisie>): AlerteSaisie => ({
  id: "a1",
  type: "baisse_moyenne",
  issue: "creee",
  niveauRisque: "eleve",
  niveauPrecedent: null,
  reactivee: false,
  statut: "active",
  periode: "Trimestre 1",
  anneeScolaire: "2026-2027",
  moyenneAvant: 12.4,
  moyenneApres: 8.9,
  ecartPourcent: 28.2,
  createdAt: "2026-10-21T10:00:00.000Z",
  ...champs,
});

describe("messageSaisie", () => {
  it("sans alerte : « Note enregistrée », « Absence enregistrée »", () => {
    expect(messageSaisie("note", eleve, null, "14/20 en SVT.")).toEqual({
      alerte: false,
      titre: "Note enregistrée",
      detail: "14/20 en SVT. Aucune alerte.",
    });
    expect(messageSaisie("absence", eleve, null, "").titre).toBe("Absence enregistrée");
  });

  it("création : « Alerte déclenchée : niveau Élevé pour Koffi Agossou », avec les moyennes", () => {
    const m = messageSaisie("note", eleve, alerte({}), "3/20 en SVT.");
    expect(m.alerte).toBe(true);
    expect(m.titre).toBe("Alerte déclenchée : niveau Élevé pour Koffi Agossou");
    expect(m.detail).toBe("3/20 en SVT. Moyenne 12,4 → 8,9 en Trimestre\u00a01 ·\u00a02026-2027 (−28,2\u00a0% par rapport à la période précédente).");
  });

  it("aggravation, et réouverture d'une alerte résolue", () => {
    expect(messageSaisie("note", eleve, alerte({ issue: "mise_a_jour", niveauPrecedent: "moyen" }), "").titre).toBe(
      "Alerte aggravée : Moyen → Élevé pour Koffi Agossou"
    );
    expect(messageSaisie("note", eleve, alerte({ issue: "mise_a_jour", niveauPrecedent: "moyen", reactivee: true }), "").titre).toBe(
      "Alerte rouverte et aggravée : Moyen → Élevé pour Koffi Agossou"
    );
  });

  it("absences : niveau et nombre d'absences injustifiées", () => {
    const m = messageSaisie("absence", eleve, alerte({ type: "absences", niveauRisque: "moyen", moyenneAvant: 0, moyenneApres: 5 }), "Absence du 21 octobre.");
    expect(m.titre).toBe("Alerte déclenchée : niveau Moyen pour Koffi Agossou");
    expect(m.detail).toBe("Absence du 21 octobre. 5 absences injustifiées en Trimestre\u00a01 ·\u00a02026-2027.");
  });
});

describe("texteComparaison (fiche élève)", () => {
  it("nouvel élève : « Pas encore de période de comparaison », les absences restant suivies", () => {
    expect(texteComparaison({ etat: "sans_periode_precedente" })).toBe(
      "Pas encore de période de comparaison pour les notes. Les absences restent suivies."
    );
  });

  it("une note dans la période en cours : à partir de 2 notes", () => {
    expect(
      texteComparaison({ etat: "notes_insuffisantes", periodeRecente: { periode: "Trimestre 1", anneeScolaire: "2026-2027", moyenne: 9, noteCount: 1 } })
    ).toBe("Notes comparées à partir de 2 notes en Trimestre\u00a01 ·\u00a02026-2027 (1 pour l'instant). Les absences restent suivies.");
  });

  it("moyennes comparées : aucune mention", () => {
    expect(texteComparaison(comparerMoyennes([note(15, "Trimestre 1"), note(15, "Trimestre 2"), note(15, "Trimestre 2")]))).toBeNull();
  });
});
