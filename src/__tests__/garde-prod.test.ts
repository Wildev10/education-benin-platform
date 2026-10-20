import { afterEach, describe, expect, it, vi } from "vitest";
import { diagnostiquerBase, verifierBaseNonProtegee } from "../../prisma/garde-prod";

// Hôtes fictifs : aucun test ne lit ni ne contacte une vraie base
const URL_DEV = "postgresql://dev:***@ep-dev-123456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const URL_PROD = "postgresql://prod:***@ep-prod-654321-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const HOTE_PROD = "ep-prod-654321";

describe("diagnostiquerBase", () => {
  it("PROTECTED_DB_HOSTS absente : bloque, avec un message qui dit quoi faire", () => {
    const d = diagnostiquerBase({ databaseUrl: URL_DEV, hostsProtegees: undefined });
    expect(d.autorise).toBe(false);
    if (!d.autorise) {
      expect(d.message).toContain("PROTECTED_DB_HOSTS est vide ou absente");
      expect(d.message).toContain("Ajoutez dans .env");
    }
  });

  it.each([[""], ["   "], [","], [' "" , \'\' ']])("PROTECTED_DB_HOSTS vide (%j) : bloque", (valeur) => {
    const d = diagnostiquerBase({ databaseUrl: URL_DEV, hostsProtegees: valeur });
    expect(d.autorise).toBe(false);
    if (!d.autorise) expect(d.message).toContain("vide ou absente");
  });

  it("hôte protégé : bloque et nomme l'hôte", () => {
    const d = diagnostiquerBase({ databaseUrl: URL_PROD, hostsProtegees: HOTE_PROD });
    expect(d.autorise).toBe(false);
    if (!d.autorise) expect(d.message).toContain(`Base de PRODUCTION détectée (${HOTE_PROD})`);
  });

  it("hôte protégé parmi plusieurs, avec espaces et guillemets : bloque", () => {
    const d = diagnostiquerBase({ databaseUrl: URL_PROD, hostsProtegees: ` "ep-autre-111" , '${HOTE_PROD}' ` });
    expect(d.autorise).toBe(false);
  });

  it("hôte non protégé : autorise", () => {
    expect(diagnostiquerBase({ databaseUrl: URL_DEV, hostsProtegees: HOTE_PROD })).toEqual({ autorise: true });
  });

  it("URL non analysable : recherche brute de l'hôte protégé", () => {
    expect(diagnostiquerBase({ databaseUrl: `host=${HOTE_PROD}.neon.tech dbname=x`, hostsProtegees: HOTE_PROD }).autorise).toBe(false);
  });

  it("DATABASE_URL absente : bloque", () => {
    const d = diagnostiquerBase({ databaseUrl: undefined, hostsProtegees: HOTE_PROD });
    expect(d).toEqual({ autorise: false, message: "DATABASE_URL non définie — script bloqué." });
  });

  it("--autoriser-prod : contournement explicite, inchangé", () => {
    expect(diagnostiquerBase({ databaseUrl: URL_PROD, hostsProtegees: HOTE_PROD, autoriserProd: true }).autorise).toBe(true);
  });
});

describe("verifierBaseNonProtegee", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function executer(env: { DATABASE_URL?: string; PROTECTED_DB_HOSTS?: string }) {
    vi.stubEnv("DATABASE_URL", env.DATABASE_URL);
    vi.stubEnv("PROTECTED_DB_HOSTS", env.PROTECTED_DB_HOSTS);
    const sortie = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    let arrete = false;
    try {
      verifierBaseNonProtegee();
    } catch {
      arrete = true;
    }
    return { arrete, code: sortie.mock.calls[0]?.[0], message: String(erreur.mock.calls[0]?.[0] ?? "") };
  }

  it("variable absente : arrête le script (code 1)", () => {
    const r = executer({ DATABASE_URL: URL_DEV, PROTECTED_DB_HOSTS: undefined });
    expect(r).toMatchObject({ arrete: true, code: 1 });
    expect(r.message).toContain("vide ou absente");
  });

  it("variable vide : arrête le script (code 1)", () => {
    expect(executer({ DATABASE_URL: URL_DEV, PROTECTED_DB_HOSTS: "" })).toMatchObject({ arrete: true, code: 1 });
  });

  it("hôte protégé : arrête le script (code 1)", () => {
    expect(executer({ DATABASE_URL: URL_PROD, PROTECTED_DB_HOSTS: HOTE_PROD })).toMatchObject({ arrete: true, code: 1 });
  });

  it("hôte non protégé : laisse continuer", () => {
    expect(executer({ DATABASE_URL: URL_DEV, PROTECTED_DB_HOSTS: HOTE_PROD })).toMatchObject({ arrete: false, code: undefined });
  });
});
