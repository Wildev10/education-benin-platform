import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  donneesTransition,
  etapeAggravation,
  responsableApres,
  libelleStatut,
  statutApres,
  statutSuivi,
  suggestionCloture,
  validerSaisieSuivi,
} from "@/lib/suivi-alertes";
import { delaiMoyenJours, repartitionMotifs } from "@/lib/pilotage-suivi";

// ── Règles pures ─────────────────────────────────────────────────────────────

describe("statut de suivi, déduit de statut et suiviDepuis", () => {
  it("active sans suiviDepuis : Nouvelle ; avec : En cours de suivi ; traitee : Résolue", () => {
    expect(statutSuivi({ statut: "active", suiviDepuis: null })).toBe("nouvelle");
    expect(statutSuivi({ statut: "active", suiviDepuis: "2026-10-01T10:00:00.000Z" })).toBe("en_suivi");
    expect(statutSuivi({ statut: "traitee", suiviDepuis: null })).toBe("resolue");
    expect(libelleStatut({ statut: "active", suiviDepuis: new Date() })).toBe("En cours de suivi");
  });
});

describe("transitions", () => {
  it("suivre et résoudre depuis Nouvelle ou En cours ; rouvrir seulement une Résolue", () => {
    expect(statutApres("nouvelle", "suivre")).toBe("en_suivi");
    expect(statutApres("en_suivi", "suivre")).toBe("en_suivi");
    expect(statutApres("nouvelle", "resoudre")).toBe("resolue");
    expect(statutApres("en_suivi", "resoudre")).toBe("resolue");
    expect(statutApres("resolue", "rouvrir")).toBe("en_suivi");
  });

  it("interdites : agir sur une Résolue sans la rouvrir, rouvrir une alerte ouverte", () => {
    expect(statutApres("resolue", "suivre")).toBeNull();
    expect(statutApres("resolue", "resoudre")).toBeNull();
    expect(statutApres("nouvelle", "rouvrir")).toBeNull();
    expect(statutApres("en_suivi", "rouvrir")).toBeNull();
  });

  it("colonnes écrites : suiviDepuis gardé, resolueLe à la résolution, remis à zéro à la réouverture", () => {
    const t0 = new Date("2026-10-01T09:00:00Z");
    const t1 = new Date("2026-10-05T09:00:00Z");
    expect(donneesTransition("suivre", { suiviDepuis: null }, t1)).toEqual({ statut: "active", suiviDepuis: t1, resolueLe: null, motifCloture: null });
    expect(donneesTransition("suivre", { suiviDepuis: t0 }, t1)).toEqual({ statut: "active", suiviDepuis: t0, resolueLe: null, motifCloture: null });
    expect(donneesTransition("resoudre", { suiviDepuis: t0 }, t1, "erreur_saisie")).toEqual({ statut: "traitee", suiviDepuis: t0, resolueLe: t1, motifCloture: "erreur_saisie" });
    expect(donneesTransition("rouvrir", { suiviDepuis: t0 }, t1)).toEqual({ statut: "active", suiviDepuis: t1, resolueLe: null, motifCloture: null });
  });
});

describe("validation de la saisie", () => {
  const commentaire = "Entretien mené avec l'élève ce matin.";

  it("action et commentaire obligatoires", () => {
    expect(validerSaisieSuivi({ transition: "suivre", action: "entretien_eleve", commentaire })).toEqual({
      ok: true,
      saisie: { transition: "suivre", action: "entretien_eleve", commentaire, motifCloture: null, responsableId: null },
    });
    expect(validerSaisieSuivi({ transition: "suivre", commentaire }).ok).toBe(false);
    expect(validerSaisieSuivi({ transition: "suivre", action: "inventee", commentaire }).ok).toBe(false);
    expect(validerSaisieSuivi({ transition: "suivre", action: "autre", commentaire: "  court  " }).ok).toBe(false);
    expect(validerSaisieSuivi({ transition: "suivre", action: "autre", commentaire: "x".repeat(1001) }).ok).toBe(false);
    expect(validerSaisieSuivi({ transition: "supprimer", action: "autre", commentaire }).ok).toBe(false);
    expect(validerSaisieSuivi(null).ok).toBe(false);
  });

  it("rouvrir : commentaire obligatoire, action enregistrée « reouverture »", () => {
    expect(validerSaisieSuivi({ transition: "rouvrir", commentaire })).toEqual({
      ok: true,
      saisie: { transition: "rouvrir", action: "reouverture", commentaire, motifCloture: null, responsableId: null },
    });
    expect(validerSaisieSuivi({ transition: "rouvrir", commentaire: "" }).ok).toBe(false);
  });

  it("le commentaire est enregistré sans les espaces autour", () => {
    const r = validerSaisieSuivi({ transition: "suivre", action: "autre", commentaire: `  ${commentaire}  ` });
    expect(r.ok && r.saisie.commentaire).toBe(commentaire);
  });
});

describe("résolution directe : un motif, commentaire facultatif sauf pour « Autre »", () => {
  it("motif seul : accepté, action « resolution », sans responsable", () => {
    for (const motif of ["situation_retablie", "suivi_externe", "erreur_saisie"]) {
      expect(validerSaisieSuivi({ transition: "resoudre", motifCloture: motif })).toEqual({
        ok: true,
        saisie: { transition: "resoudre", action: "resolution", commentaire: "", motifCloture: motif, responsableId: null },
      });
    }
  });

  it("« Autre » : commentaire obligatoire (10 caractères au moins)", () => {
    expect(validerSaisieSuivi({ transition: "resoudre", motifCloture: "autre" })).toMatchObject({ ok: false, erreur: expect.stringContaining("« Autre »") });
    expect(validerSaisieSuivi({ transition: "resoudre", motifCloture: "autre", commentaire: "Élève changé d'établissement." }).ok).toBe(true);
  });

  it("motif absent ou inconnu : refusé", () => {
    expect(validerSaisieSuivi({ transition: "resoudre", action: "entretien_eleve", commentaire: "Une action, pas un motif." }).ok).toBe(false);
    expect(validerSaisieSuivi({ transition: "resoudre", motifCloture: "inventé" }).ok).toBe(false);
  });

  it("possible depuis Nouvelle comme depuis En cours de suivi", () => {
    expect(statutApres("nouvelle", "resoudre")).toBe("resolue");
    expect(statutApres("en_suivi", "resoudre")).toBe("resolue");
  });
});

describe("responsable du suivi", () => {
  it("confier : responsable obligatoire, commentaire facultatif, seulement En cours de suivi", () => {
    expect(validerSaisieSuivi({ transition: "confier" }).ok).toBe(false);
    expect(validerSaisieSuivi({ transition: "confier", responsableId: "u2" })).toEqual({
      ok: true,
      saisie: { transition: "confier", action: "confie", commentaire: "", motifCloture: null, responsableId: "u2" },
    });
    expect(statutApres("en_suivi", "confier")).toBe("en_suivi");
    expect(statutApres("nouvelle", "confier")).toBeNull();
    expect(statutApres("resolue", "confier")).toBeNull();
  });

  it("par défaut, l'auteur de la première action ; ensuite, le responsable en place ; la résolution ne change rien", () => {
    expect(responsableApres("suivre", null, null, "auteur")).toBe("auteur");
    expect(responsableApres("suivre", "u2", null, "auteur")).toBe("u2");
    expect(responsableApres("suivre", null, "u3", "auteur")).toBe("u3");
    expect(responsableApres("rouvrir", null, "u3", "auteur")).toBe("u3");
    expect(responsableApres("rouvrir", null, null, "auteur")).toBe("auteur");
    expect(responsableApres("resoudre", null, null, "auteur")).toBeNull();
    expect(responsableApres("confier", "u2", "u3", "auteur")).toBe("u2");
  });
});

describe("étape écrite par la détection lors d'une aggravation", () => {
  it("alerte résolue avec un responsable : rouverte En cours de suivi, avec lui", () => {
    expect(etapeAggravation("resolue", "moyen", "eleve", "Fulbert Gbaguidi")).toMatchObject({
      action: "reouverture_auto",
      statutApres: "en_suivi",
      commentaire: "Risque Moyen → Élevé. L'alerte résolue est rouverte, suivi repris par Fulbert Gbaguidi.",
    });
  });

  it("alerte résolue : rouverte automatiquement en Nouvelle", () => {
    expect(etapeAggravation("resolue", "moyen", "eleve")).toMatchObject({
      action: "reouverture_auto",
      statutAvant: "resolue",
      statutApres: "nouvelle",
      commentaire: "Risque Moyen → Élevé. L'alerte résolue est rouverte.",
    });
  });

  it("alerte en cours de suivi : le statut ne change pas", () => {
    expect(etapeAggravation("en_suivi", "moyen", "eleve")).toMatchObject({ action: "aggravation", statutAvant: "en_suivi", statutApres: "en_suivi" });
  });
});

// ── Suggestion de clôture ────────────────────────────────────────────────────

const T1 = { anneeScolaire: "2026-2027", periode: "Trimestre 1" };
const T2 = { anneeScolaire: "2026-2027", periode: "Trimestre 2" };
const note = (valeur: number, p = T1) => ({ valeur, ...p });
const alerteNotes = { type: "baisse_moyenne", statut: "active", moyenneAvant: 13, ...T1 };
const alerteAbsences = { type: "absences", statut: "active", moyenneAvant: 0, ...T1 };

describe("suggestion de clôture", () => {
  it("notes : moyenne revenue sans baisse d'au moins 15 % par rapport à la référence → suggérée", () => {
    const notes = [note(13, { anneeScolaire: "2025-2026", periode: "Trimestre 3" }), note(12), note(11.5)];
    expect(suggestionCloture(alerteNotes, notes, [], T1)).toBe(
      "Moyenne remontée à 11,8 au Trimestre 1 (référence 13,0). Vous pouvez résoudre l'alerte."
    );
  });

  it("notes : moyenne encore trop basse, ou une seule note → rien", () => {
    const avant = note(13, { anneeScolaire: "2025-2026", periode: "Trimestre 3" });
    expect(suggestionCloture(alerteNotes, [avant, note(10), note(10.5)], [], T1)).toBeNull();
    expect(suggestionCloture(alerteNotes, [avant, note(15)], [], T1)).toBeNull();
  });

  it("absences : nouveau trimestre sous le seuil de 5 absences injustifiées → suggérée", () => {
    const absences = [...Array(3)].map(() => ({ motif: "injustifiee", ...T2 }));
    expect(suggestionCloture(alerteAbsences, [], absences, T2)).toBe(
      "Assiduité rétablie : 3 absences injustifiées au Trimestre 2. Vous pouvez résoudre l'alerte."
    );
  });

  it("absences : même trimestre que l'alerte, ou toujours 5 absences ou plus → rien", () => {
    expect(suggestionCloture(alerteAbsences, [], [], T1)).toBeNull();
    const absences = [...Array(5)].map(() => ({ motif: "injustifiee", ...T2 }));
    expect(suggestionCloture(alerteAbsences, [], absences, T2)).toBeNull();
  });

  it("alerte résolue : jamais de suggestion", () => {
    expect(suggestionCloture({ ...alerteAbsences, statut: "traitee" }, [], [], T2)).toBeNull();
  });
});

describe("pilotage : répartition des motifs de clôture", () => {
  it("la plus fréquente en tête, les résolutions sans motif à part, les motifs absents omis", () => {
    expect(repartitionMotifs([
      { motifCloture: "suivi_externe", total: 1 },
      { motifCloture: "situation_retablie", total: 4 },
      { motifCloture: null, total: 2 },
    ])).toEqual([
      { motif: "situation_retablie", libelle: "Situation rétablie", total: 4 },
      { motif: "non_renseigne", libelle: "Motif non renseigné", total: 2 },
      { motif: "suivi_externe", libelle: "Suivi fait en dehors de la plateforme", total: 1 },
    ]);
  });
});

describe("pilotage : délai moyen avant la première action", () => {
  it("moyenne en jours, au dixième ; null sans action", () => {
    const d = (j: string) => new Date(`2026-10-${j}T10:00:00Z`);
    expect(delaiMoyenJours([])).toBeNull();
    expect(delaiMoyenJours([{ createdAt: d("01"), premiereAction: d("03") }, { createdAt: d("01"), premiereAction: d("02") }])).toBe(1.5);
  });
});

// ── Route POST /api/alertes/[id]/suivis ──────────────────────────────────────

// vi.hoisted : delaiMoyenJours (importé en tête) charge @/lib/prisma, déjà simulé
const { mockRequireRole, tx, prismaMock } = vi.hoisted(() => {
  const tx = {
    alerte: { updateMany: vi.fn(), findUnique: vi.fn() },
    suiviAlerte: { create: vi.fn() },
  };
  return {
    mockRequireRole: vi.fn(),
    tx,
    prismaMock: {
      alerte: { findUnique: vi.fn() },
      // findFirst : le responsable choisi est-il un enseignant ou le directeur de l'établissement ?
      user: { findUnique: vi.fn(), findFirst: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});
vi.mock("@/lib/auth-guard", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { POST } = await import("@/app/api/alertes/[id]/suivis/route");

const MON_ETAB = "etab-zopah";
const user = (role: string, etablissementId: string | null = null) => ({ user: { id: "u1", role, etablissementId, etudiantId: null } });
const alerte = (etablissementId: string, statut = "active", suiviDepuis: Date | null = null, responsableId: string | null = null) => ({
  id: "a1",
  statut,
  suiviDepuis,
  responsableId,
  etudiant: { id: "e1", nom: "Agossou", prenom: "Rodrigue", etablissementId },
});
const appel = (corps: unknown) =>
  POST(
    new Request("http://localhost/api/alertes/a1/suivis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }),
    { params: Promise.resolve({ id: "a1" }) }
  );
const SUIVRE = { transition: "suivre", action: "entretien_eleve", commentaire: "Entretien avec l'élève ce matin." };

beforeEach(() => {
  prismaMock.$transaction.mockClear();
  mockRequireRole.mockReset();
  prismaMock.alerte.findUnique.mockReset();
  prismaMock.user.findUnique.mockReset().mockResolvedValue({ nom: "Gbaguidi", prenom: "Fulbert" });
  prismaMock.user.findFirst.mockReset().mockImplementation(async ({ where }) =>
    where.etablissementId === MON_ETAB ? { nom: where.id === "u1" ? "Gbaguidi" : "Sossou", prenom: where.id === "u1" ? "Fulbert" : "Bernadette" } : null
  );
  tx.alerte.updateMany.mockReset().mockResolvedValue({ count: 1 });
  tx.alerte.findUnique.mockReset().mockResolvedValue({ id: "a1", statut: "active", suiviDepuis: new Date(), suivis: [] });
  tx.suiviAlerte.create.mockReset();
});

describe("POST /api/alertes/[id]/suivis", () => {
  it("rôles autorisés : enseignant et directeur (l'admin consulte seulement)", async () => {
    await appel(SUIVRE);
    expect(mockRequireRole).toHaveBeenCalledWith(["enseignant", "directeur"]);
  });

  it("enseignant : alerte d'un autre établissement → 404, rien n'est écrit", async () => {
    mockRequireRole.mockResolvedValue(user("enseignant", MON_ETAB));
    prismaMock.alerte.findUnique.mockResolvedValue(alerte("autre-etab"));
    const r = await appel(SUIVRE);
    expect(r.status).toBe(404);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(tx.suiviAlerte.create).not.toHaveBeenCalled();
  });

  it("hors périmètre et inexistante : même réponse", async () => {
    mockRequireRole.mockResolvedValue(user("directeur", MON_ETAB));
    prismaMock.alerte.findUnique.mockResolvedValue(alerte("autre-etab"));
    const horsPerimetre = await appel(SUIVRE);
    prismaMock.alerte.findUnique.mockResolvedValue(null);
    const inexistante = await appel(SUIVRE);
    expect([horsPerimetre.status, await horsPerimetre.json()]).toEqual([inexistante.status, await inexistante.json()]);
  });

  it("directeur : action sur une alerte nouvelle de son établissement → 201, étape avec auteur et statuts", async () => {
    mockRequireRole.mockResolvedValue(user("directeur", MON_ETAB));
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(MON_ETAB));
    const r = await appel(SUIVRE);
    expect(r.status).toBe(201);
    expect(tx.alerte.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "a1", statut: "active", suiviDepuis: null, responsableId: null } })
    );
    expect(tx.suiviAlerte.create.mock.calls[0][0].data).toMatchObject({
      alerteId: "a1",
      auteurId: "u1",
      auteurNom: "Fulbert Gbaguidi",
      action: "entretien_eleve",
      statutAvant: "nouvelle",
      statutApres: "en_suivi",
      // Première action : l'auteur devient responsable par défaut
      responsableId: "u1",
      responsableNom: "Fulbert Gbaguidi",
    });
    expect(tx.alerte.updateMany.mock.calls[0][0].data).toMatchObject({ responsableId: "u1" });
  });

  it("responsable choisi hors de l'établissement de l'élève (ou inexistant) → 400, rien n'est écrit", async () => {
    mockRequireRole.mockResolvedValue(user("directeur", MON_ETAB));
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(MON_ETAB));
    prismaMock.user.findFirst.mockResolvedValue(null);
    const r = await appel({ ...SUIVRE, responsableId: "compte-autre-etab" });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "Responsable invalide." });
    expect(prismaMock.user.findFirst.mock.calls[0][0].where).toMatchObject({ etablissementId: MON_ETAB, role: { in: ["enseignant", "directeur"] } });
    expect(tx.suiviAlerte.create).not.toHaveBeenCalled();
  });

  it("confier le suivi à quelqu'un d'autre → 201, étape « Suivi confié » avec la personne désignée", async () => {
    mockRequireRole.mockResolvedValue(user("directeur", MON_ETAB));
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(MON_ETAB, "active", new Date("2026-10-01"), "u1"));
    const r = await appel({ transition: "confier", responsableId: "u2" });
    expect(r.status).toBe(201);
    expect(tx.alerte.updateMany.mock.calls[0][0].where).toMatchObject({ responsableId: "u1" });
    expect(tx.suiviAlerte.create.mock.calls[0][0].data).toMatchObject({
      action: "confie",
      commentaire: "",
      responsableId: "u2",
      responsableNom: "Bernadette Sossou",
      statutAvant: "en_suivi",
      statutApres: "en_suivi",
    });
  });

  it("confier à la personne déjà responsable → 400 ; confier une alerte nouvelle → 409", async () => {
    mockRequireRole.mockResolvedValue(user("enseignant", MON_ETAB));
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(MON_ETAB, "active", new Date("2026-10-01"), "u2"));
    expect((await appel({ transition: "confier", responsableId: "u2" })).status).toBe(400);
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(MON_ETAB));
    expect((await appel({ transition: "confier", responsableId: "u2" })).status).toBe(409);
  });

  it("résolution directe d'une alerte nouvelle : motif enregistré, aucun responsable désigné", async () => {
    mockRequireRole.mockResolvedValue(user("enseignant", MON_ETAB));
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(MON_ETAB));
    const r = await appel({ transition: "resoudre", motifCloture: "erreur_saisie" });
    expect(r.status).toBe(201);
    expect(tx.alerte.updateMany.mock.calls[0][0].data).toMatchObject({ statut: "traitee", motifCloture: "erreur_saisie" });
    expect(tx.alerte.updateMany.mock.calls[0][0].data).not.toHaveProperty("responsableId");
    expect(tx.suiviAlerte.create.mock.calls[0][0].data).toMatchObject({ action: "resolution", motifCloture: "erreur_saisie", statutAvant: "nouvelle", statutApres: "resolue" });
    expect(tx.suiviAlerte.create.mock.calls[0][0].data).not.toHaveProperty("responsableId");
  });

  it("action manquante ou commentaire trop court → 400", async () => {
    mockRequireRole.mockResolvedValue(user("enseignant", MON_ETAB));
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(MON_ETAB));
    expect((await appel({ ...SUIVRE, action: undefined })).status).toBe(400);
    expect((await appel({ ...SUIVRE, commentaire: "ok" })).status).toBe(400);
  });

  it("agir sur une alerte résolue sans la rouvrir → 409", async () => {
    mockRequireRole.mockResolvedValue(user("enseignant", MON_ETAB));
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(MON_ETAB, "traitee"));
    expect((await appel(SUIVRE)).status).toBe(409);
    expect(tx.suiviAlerte.create).not.toHaveBeenCalled();
  });

  it("rouvrir une alerte résolue → 201, Résolue → En cours de suivi", async () => {
    mockRequireRole.mockResolvedValue(user("enseignant", MON_ETAB));
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(MON_ETAB, "traitee", new Date("2026-10-01")));
    const r = await appel({ transition: "rouvrir", commentaire: "Nouvelles absences signalées par la famille." });
    expect(r.status).toBe(201);
    expect(tx.alerte.updateMany.mock.calls[0][0].data).toMatchObject({ statut: "active", resolueLe: null });
    expect(tx.suiviAlerte.create.mock.calls[0][0].data).toMatchObject({ action: "reouverture", statutAvant: "resolue", statutApres: "en_suivi" });
  });

  it("modifiée entre-temps par quelqu'un d'autre → 409, aucune étape écrite", async () => {
    mockRequireRole.mockResolvedValue(user("enseignant", MON_ETAB));
    prismaMock.alerte.findUnique.mockResolvedValue(alerte(MON_ETAB));
    tx.alerte.updateMany.mockResolvedValue({ count: 0 });
    expect((await appel(SUIVRE)).status).toBe(409);
    expect(tx.suiviAlerte.create).not.toHaveBeenCalled();
  });
});
