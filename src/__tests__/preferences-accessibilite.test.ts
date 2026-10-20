import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// localStorage et window minimaux : les tests tournent dans Node
function stockageMemoire(bloque = false) {
  const donnees = new Map<string, string>();
  return {
    getItem: (cle: string) => {
      if (bloque) throw new Error("SecurityError");
      return donnees.get(cle) ?? null;
    },
    setItem: (cle: string, valeur: string) => {
      if (bloque) throw new Error("SecurityError");
      donnees.set(cle, valeur);
    },
  };
}

async function charger({ bloque = false } = {}) {
  vi.resetModules(); // le module garde un cache : un module neuf par test
  const cible = new EventTarget();
  vi.stubGlobal("localStorage", stockageMemoire(bloque));
  vi.stubGlobal("window", {
    addEventListener: cible.addEventListener.bind(cible),
    removeEventListener: cible.removeEventListener.bind(cible),
    dispatchEvent: cible.dispatchEvent.bind(cible),
  });
  return import("@/lib/preferences-accessibilite");
}

describe("préférences d'accessibilité", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sans préférence enregistrée : valeurs par défaut, comme au rendu serveur", async () => {
    const p = await charger();
    expect(p.lirePreferences()).toEqual({ contrasteEleve: false, taille: "normal" });
    expect(p.preferencesServeur()).toEqual(p.PREFERENCES_PAR_DEFAUT);
  });

  it("relit les clés existantes (accessibility-contrast, accessibility-font-size)", async () => {
    const p = await charger();
    localStorage.setItem("accessibility-contrast", "high");
    localStorage.setItem("accessibility-font-size", "x-large");
    expect(p.lirePreferences()).toEqual({ contrasteEleve: true, taille: "x-large" });
  });

  it("valeur inconnue : taille normale", async () => {
    const p = await charger();
    localStorage.setItem("accessibility-font-size", "géante");
    expect(p.lirePreferences().taille).toBe("normal");
  });

  it("même objet tant que rien ne change (sinon useSyncExternalStore boucle)", async () => {
    const p = await charger();
    expect(p.lirePreferences()).toBe(p.lirePreferences());
    localStorage.setItem("accessibility-contrast", "high");
    const apres = p.lirePreferences();
    expect(apres.contrasteEleve).toBe(true);
    expect(p.lirePreferences()).toBe(apres);
  });

  it("enregistrer écrit les deux clés et prévient les abonnés", async () => {
    const p = await charger();
    const rappel = vi.fn();
    const desabonner = p.abonnerPreferences(rappel);
    p.enregistrerPreferences({ contrasteEleve: true, taille: "large" });
    expect(localStorage.getItem("accessibility-contrast")).toBe("high");
    expect(localStorage.getItem("accessibility-font-size")).toBe("large");
    expect(rappel).toHaveBeenCalledTimes(1);
    desabonner();
    p.enregistrerPreferences({ contrasteEleve: false, taille: "normal" });
    expect(rappel).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("accessibility-contrast")).toBe("default");
  });

  it("stockage bloqué : pas d'erreur, la préférence vaut pour la page en cours", async () => {
    const p = await charger({ bloque: true });
    expect(p.lirePreferences()).toEqual(p.PREFERENCES_PAR_DEFAUT);
    p.enregistrerPreferences({ contrasteEleve: true, taille: "large" });
    expect(p.lirePreferences()).toEqual({ contrasteEleve: true, taille: "large" });
  });
});

describe("redirigerVersConnexion", () => {
  beforeEach(() => vi.stubGlobal("window", { location: { assign: vi.fn() } }));
  afterEach(() => vi.unstubAllGlobals());

  it("recharge complètement la page de connexion (session expirée)", async () => {
    const { redirigerVersConnexion } = await import("@/lib/session-expiree");
    redirigerVersConnexion();
    expect(window.location.assign).toHaveBeenCalledWith("/login");
  });
});
