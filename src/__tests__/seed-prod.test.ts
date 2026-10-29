import { describe, expect, it } from "vitest";
import { controlerConnexion, masquer, nettoyerSaisie } from "../../prisma/seed-prod-outils";

// Hôtes et mots de passe fictifs : aucun test ne contacte une vraie base
const HOTE_PROD = "ep-prod-654321-pooler.eu-central-1.aws.neon.tech";
const MOT_DE_PASSE = "Mot2Passe/Fictif";
const URL_PROD = `postgresql://neondb_owner:${encodeURIComponent(MOT_DE_PASSE)}@${HOTE_PROD}/neondb?sslmode=require`;
const URL_DEV = "postgresql://neondb_owner:autre@ep-dev-123456-pooler.eu-central-1.aws.neon.tech/neondb";

describe("controlerConnexion : l'hôte doit être dans PROTECTED_DB_HOSTS", () => {
  it("hôte de production listé : accepté, avec l'hôte seul et les secrets à masquer", () => {
    const r = controlerConnexion(`  ${URL_PROD}  `, `"autre.example", ${HOTE_PROD}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.hote).toBe(HOTE_PROD);
    expect(r.secrets).toEqual(expect.arrayContaining([URL_PROD, encodeURIComponent(MOT_DE_PASSE), MOT_DE_PASSE]));
  });

  it("même règle que le garde-fou : une entrée sans « -pooler » reconnaît l'hôte pooler", () => {
    expect(controlerConnexion(URL_PROD, "ep-prod-654321").ok).toBe(true);
  });

  it("hôte absent de la liste : refusé, le message cite l'hôte mais jamais le mot de passe", () => {
    const r = controlerConnexion(URL_DEV, HOTE_PROD);
    expect(r).toMatchObject({ ok: false });
    if (r.ok) return;
    expect(r.message).toContain("ep-dev-123456-pooler");
    expect(r.message).not.toContain("autre");
  });

  it("liste vide ou absente : refusé", () => {
    expect(controlerConnexion(URL_PROD, "").ok).toBe(false);
    expect(controlerConnexion(URL_PROD, undefined).ok).toBe(false);
  });

  it("saisie qui n'est pas une chaîne PostgreSQL : refusée sans la recopier", () => {
    for (const saisie of ["n'importe quoi", "https://exemple.bj", ""]) {
      const r = controlerConnexion(saisie, HOTE_PROD);
      expect(r.ok).toBe(false);
      if (!r.ok && saisie) expect(r.message).not.toContain(saisie);
    }
  });
});

describe("masquer", () => {
  const r = controlerConnexion(URL_PROD, HOTE_PROD);
  const secrets = r.ok ? r.secrets : [];

  it("la chaîne entière et le mot de passe (encodé ou non) deviennent ***", () => {
    expect(masquer(`connexion ${URL_PROD} refusée`, secrets)).toBe("connexion *** refusée");
    expect(masquer(`password ${MOT_DE_PASSE} et ${encodeURIComponent(MOT_DE_PASSE)}`, secrets)).toBe("password *** et ***");
  });

  it("l'hôte reste lisible", () => {
    expect(masquer(`SIMULATION sur l'hôte ${HOTE_PROD}`, secrets)).toBe(`SIMULATION sur l'hôte ${HOTE_PROD}`);
  });
});

describe("nettoyerSaisie", () => {
  it("retire les marqueurs de collage, le retour chariot et les espaces", () => {
    expect(nettoyerSaisie(`\u001b[200~${URL_PROD}\u001b[201~\r`)).toBe(URL_PROD);
  });
});
