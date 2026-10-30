import { describe, expect, it } from "vitest";
import { periodeScolaireAuBenin, periodeScolaireDuJour } from "@/lib/annee-scolaire";
import { jourIsoAuBenin } from "@/lib/dates";
import { CAS, genererDonneesDemo, type DonneesDemo } from "@/lib/demo/generer";
import { NIVEAUX, matieresDuNiveau } from "@/lib/programme";
import { comparerMoyennes, compterAbsencesRecentes, estAggravation } from "@/lib/regles-alerte";

// Un lancement par trimestre, plus deux débuts de trimestre (peu de jours écoulés)
const DATES = {
  "T1 (21 octobre 2026)": new Date("2026-10-21T10:00:00Z"),
  "T2 (10 février 2027)": new Date("2027-02-10T15:00:00Z"),
  "T3 (20 mai 2027)": new Date("2027-05-20T08:00:00Z"),
  "rentrée (2 septembre 2026)": new Date("2026-09-02T07:00:00Z"),
  "janvier (4 janvier 2027)": new Date("2027-01-04T06:00:00Z"),
};

const generees = Object.fromEntries(
  Object.entries(DATES).map(([nom, date]) => [nom, { date, d: genererDonneesDemo(date) }])
) as Record<string, { date: Date; d: DonneesDemo }>;

const notesDe = (d: DonneesDemo, id: string) => d.notes.filter((n) => n.etudiantId === id);
const demoId = (d: DonneesDemo) => d.etablissements.find((e) => e.nom === "CEG Zopah")!.id;

describe.each(Object.keys(DATES))("Données de démo, lancées en %s", (nom) => {
  const { date, d } = generees[nom];
  const aujourdhui = jourIsoAuBenin(date);

  it("prend le trimestre du jour comme période en cours, après l'année précédente complète", () => {
    expect(d.enCours).toEqual(periodeScolaireAuBenin(date));
    expect(d.periodes.at(-1)).toEqual(d.enCours);
    expect(d.periodes.filter((p) => p.anneeScolaire !== d.enCours.anneeScolaire)).toHaveLength(3);
  });

  it("9 établissements dans 9 départements, environ 300 élèves, autant de filles que de garçons", () => {
    expect(d.etablissements).toHaveLength(9);
    expect(new Set(d.etablissements.map((e) => e.departement)).size).toBe(9);
    expect(d.etudiants.length).toBeGreaterThanOrEqual(280);
    for (const etab of d.etablissements) {
      const eleves = d.etudiants.filter((e) => e.etablissementId === etab.id);
      const filles = eleves.filter((e) => e.sexe === "F").length;
      expect(Math.abs(filles - eleves.length / 2)).toBeLessThanOrEqual(1);
    }
  });

  it("noms uniques, classes connues", () => {
    const noms = d.etudiants.map((e) => `${e.prenom} ${e.nom}`);
    expect(new Set(noms).size).toBe(noms.length);
    for (const e of d.etudiants) expect(NIVEAUX).toContain(e.niveau);
  });

  it("notes sur 20 au quart de point, dans les matières de la classe de l'année, saisies dans leur trimestre", () => {
    const inscription = new Map(d.inscriptions.map((i) => [`${i.etudiantId}|${i.anneeScolaire}`, i.niveau]));
    for (const n of d.notes) {
      expect(n.valeur).toBeGreaterThanOrEqual(0);
      expect(n.valeur).toBeLessThanOrEqual(20);
      expect(Number.isInteger(n.valeur * 4)).toBe(true);
      const niveau = inscription.get(`${n.etudiantId}|${n.anneeScolaire}`);
      expect(niveau).toBeDefined();
      expect(matieresDuNiveau(niveau)).toContain(n.matiere);
      expect(n.createdAt.getTime()).toBeLessThanOrEqual(date.getTime());
      expect(periodeScolaireAuBenin(n.createdAt)).toEqual({ anneeScolaire: n.anneeScolaire, periode: n.periode });
    }
  });

  it("absences datées dans leur trimestre, jamais après aujourd'hui", () => {
    for (const a of d.absences) {
      const jour = a.date.toISOString().slice(0, 10); // minuit UTC, comme le formulaire de saisie
      expect(jour <= aujourdhui).toBe(true);
      expect(periodeScolaireDuJour(jour)).toEqual({ anneeScolaire: a.anneeScolaire, periode: a.periode });
      expect(a.createdAt.getTime()).toBeLessThanOrEqual(date.getTime());
    }
  });

  it("chaque alerte suit les règles de l'application ; aucune en dehors des cas au CEG Zopah", () => {
    for (const e of d.etudiants) {
      const attendu = [];
      const c = comparerMoyennes(notesDe(d, e.id));
      if (c.etat === "comparee" && c.niveauRisque) attendu.push(`baisse_moyenne:${c.niveauRisque}`);
      const abs = compterAbsencesRecentes(d.absences.filter((a) => a.etudiantId === e.id && a.motif === "injustifiee"));
      if (abs?.niveauRisque) attendu.push(`absences:${abs.niveauRisque}`);
      const obtenu = d.alertes.filter((a) => a.etudiantId === e.id).map((a) => `${a.type}:${a.niveauRisque}`);
      expect(obtenu.sort()).toEqual(attendu.sort());
    }

    const casIds = new Set(Object.values(d.cas).map((e) => e.id));
    const alertesDemo = d.alertes.filter((a) => d.etudiants.find((e) => e.id === a.etudiantId)!.etablissementId === demoId(d));
    expect(alertesDemo.every((a) => casIds.has(a.etudiantId))).toBe(true);

    const taux = new Set(d.alertes.map((a) => a.etudiantId)).size / d.etudiants.length;
    expect(taux).toBeGreaterThan(0.03);
    expect(taux).toBeLessThan(0.1);
    for (const a of d.alertes) expect(a.createdAt.getTime()).toBeLessThanOrEqual(date.getTime());
  });

  it("cas de la démo : Élevé, Moyen, absences, Moyen avant aggravation, nouvel élève, compte étudiant sans alerte", () => {
    const alertesDe = (cle: keyof typeof CAS) =>
      d.alertes.filter((a) => a.etudiantId === d.cas[cle].id).map((a) => `${a.type}:${a.niveauRisque}`);
    expect(alertesDe("chute")).toEqual(["baisse_moyenne:eleve"]);
    expect(alertesDe("baisse")).toEqual(["baisse_moyenne:moyen"]);
    expect(alertesDe("absences")).toEqual(["absences:moyen"]);
    expect(alertesDe("aggravation")).toEqual(["baisse_moyenne:moyen"]);
    expect(alertesDe("nouveau")).toEqual([]);
    expect(alertesDe("compteEtudiant")).toEqual([]);

    expect(comparerMoyennes(notesDe(d, d.cas.nouveau.id)).etat).toBe("sans_periode_precedente");
    const absencesInoussa = d.absences.filter((a) => a.etudiantId === d.cas.absences.id && a.motif === "injustifiee");
    expect(compterAbsencesRecentes(absencesInoussa)).toMatchObject({ ...d.enCours, count: 7 });
    for (const cle of Object.keys(CAS) as (keyof typeof CAS)[]) {
      expect(d.cas[cle].etablissementId).toBe(demoId(d));
    }
  });

  it("suivi des alertes : étapes datées entre la détection et le jour du seed, statuts cohérents", () => {
    const alertes = new Map(d.alertes.map((a) => [a.id, a]));
    for (const e of d.suivis) {
      const a = alertes.get(e.alerteId)!;
      expect(e.createdAt.getTime()).toBeGreaterThan(a.createdAt.getTime());
      expect(e.createdAt.getTime()).toBeLessThan(date.getTime());
      // Commentaire obligatoire, sauf clôture (motif) et désignation du responsable
      if (e.action === "resolution") expect(e.motifCloture).not.toBeNull();
      else if (e.action !== "confie") expect(e.commentaire.length).toBeGreaterThanOrEqual(10);
    }
    for (const a of d.alertes) {
      const etapes = d.suivis.filter((e) => e.alerteId === a.id);
      if (etapes.length === 0) {
        expect(a).toMatchObject({ statut: "active", suiviDepuis: null, resolueLe: null });
        continue;
      }
      expect(etapes[0].statutAvant).toBe("nouvelle");
      expect(a.suiviDepuis).toEqual(etapes[0].createdAt);
      const derniere = etapes.at(-1)!;
      expect(a.statut).toBe(derniere.statutApres === "resolue" ? "traitee" : "active");
      if (a.statut === "traitee") expect(a.resolueLe).toEqual(derniere.createdAt);
    }
  });

  it("suivi au CEG Zopah : Rodrigue et Inoussa en cours de suivi par les comptes de démo, Adéola et Sèna nouvelles", () => {
    const alerteDe = (cle: keyof typeof CAS) => d.alertes.find((a) => a.etudiantId === d.cas[cle].id)!;
    const etapesDe = (cle: keyof typeof CAS) => d.suivis.filter((e) => e.alerteId === alerteDe(cle).id);
    for (const cle of ["chute", "absences"] as const) {
      // Une alerte détectée moins d'un jour avant le seed reste nouvelle
      if (date.getTime() - alerteDe(cle).createdAt.getTime() < 25 * 60 * 60 * 1000) continue;
      expect(alerteDe(cle).statut).toBe("active");
      expect(alerteDe(cle).suiviDepuis).not.toBeNull();
      expect(etapesDe(cle).every((e) => e.auteur === "enseignant" || e.auteur === "directeur")).toBe(true);
    }
    for (const cle of ["baisse", "aggravation"] as const) {
      expect(alerteDe(cle)).toMatchObject({ statut: "active", suiviDepuis: null, responsable: null });
      expect(etapesDe(cle)).toEqual([]);
    }
  });

  it("responsables : Rodrigue suivi par l'enseignant ; Inoussa confié par la directrice à l'enseignant ; ailleurs, à désigner", () => {
    const alerteDe = (cle: keyof typeof CAS) => d.alertes.find((a) => a.etudiantId === d.cas[cle].id)!;
    const recente = (cle: keyof typeof CAS) => date.getTime() - alerteDe(cle).createdAt.getTime() < 25 * 60 * 60 * 1000;
    if (!recente("chute")) expect(alerteDe("chute").responsable).toBe("enseignant");
    if (!recente("absences")) {
      expect(alerteDe("absences").responsable).toBe("enseignant");
      const confie = d.suivis.find((e) => e.alerteId === alerteDe("absences").id && e.action === "confie")!;
      expect(confie).toMatchObject({ auteur: "directeur", responsable: "enseignant", responsableNom: "Fulbert Gbaguidi" });
      expect(alerteDe("absences").responsableDepuis).toEqual(confie.createdAt);
    }
    const autres = d.alertes.filter((a) => d.etudiants.find((e) => e.id === a.etudiantId)!.etablissementId !== demoId(d));
    expect(autres.every((a) => a.responsable === null)).toBe(true);
    for (const a of d.alertes.filter((x) => x.statut === "traitee")) expect(a.motifCloture).not.toBeNull();
  });

  it("Sèna Dossou : une note ne change rien, la deuxième fait passer l'alerte de Moyen à Élevé", () => {
    const notes = notesDe(d, d.cas.aggravation.id);
    const saisir = (...valeurs: number[]) => {
      const c = comparerMoyennes([...notes, ...valeurs.map((valeur) => ({ valeur, ...d.enCours }))]);
      return c.etat === "comparee" ? c.niveauRisque : null;
    };
    const alerte = d.alertes.find((a) => a.etudiantId === d.cas.aggravation.id)!;
    expect(alerte).toMatchObject({ niveauRisque: "moyen", ...d.enCours });

    for (const [premiere, seconde] of [[6, 6], [5, 7], [4, 9], [7, 6]]) {
      expect(saisir(premiere)).toBe("moyen");
      expect(saisir(premiere, seconde)).toBe("eleve");
      expect(estAggravation(alerte, "eleve")).toBe(true);
    }
    // Deux notes qui font 14 ou plus : la moyenne reste à 10 au moins
    expect(saisir(7, 7)).toBe("moyen");
    expect(saisir(3)).toBe("eleve");
  });

  it("comptes : noms béninois, enseignant et directeur au CEG Zopah, compte étudiant relié à Prudence Ahouansou", () => {
    expect(d.comptes.directeur).toMatchObject({ nom: "Sossou", prenom: "Bernadette", etablissementId: demoId(d) });
    expect(d.comptes.enseignant).toMatchObject({ nom: "Gbaguidi", prenom: "Fulbert", etablissementId: demoId(d) });
    expect(d.comptes.admin).toMatchObject({ nom: "Kpadonou", prenom: "Arsène", etablissementId: null });
    expect(d.comptes.etudiant.etudiantId).toBe(d.cas.compteEtudiant.id);
    expect(d.cas.compteEtudiant).toMatchObject({ prenom: "Prudence", nom: "Ahouansou" });
  });

  it("historique : chaque entrée désigne une note ou une absence du trimestre en cours au CEG Zopah", () => {
    const ids = new Set([...d.notes.map((n) => n.id), ...d.absences.map((a) => a.id)]);
    expect(d.journal.length).toBeGreaterThan(0);
    for (const j of d.journal) expect(ids.has(j.entityId)).toBe(true);
  });
});

describe("Données de démo : reproductibles", () => {
  it("mêmes établissements, élèves et identifiants quelle que soit la date de lancement", () => {
    const [a, b] = [generees["T1 (21 octobre 2026)"].d, generees["T3 (20 mai 2027)"].d];
    expect(b.etablissements.map((e) => [e.id, e.nom])).toEqual(a.etablissements.map((e) => [e.id, e.nom]));
    expect(b.etudiants.map((e) => [e.id, e.prenom, e.nom, e.niveau])).toEqual(a.etudiants.map((e) => [e.id, e.prenom, e.nom, e.niveau]));
  });

  it("deux lancements le même jour donnent exactement les mêmes données", () => {
    const date = DATES["T2 (10 février 2027)"];
    expect(genererDonneesDemo(date)).toEqual(genererDonneesDemo(date));
  });

  it("identifiants uniques", () => {
    const d = generees["T3 (20 mai 2027)"].d;
    const ids = [d.etablissements, d.etudiants, d.inscriptions, d.notes, d.absences, d.alertes, d.journal].flat().map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("début de trimestre : avertissement quand peu de jours de classe se sont écoulés", () => {
    expect(generees["rentrée (2 septembre 2026)"].d.avertissements).toHaveLength(1);
    expect(generees["T1 (21 octobre 2026)"].d.avertissements).toEqual([]);
  });
});
