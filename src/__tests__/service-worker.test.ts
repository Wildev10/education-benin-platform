import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Les vrais fichiers servis au navigateur, exécutés dans un environnement simulé
const SOURCE_SW = readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");
const SOURCE_STRATEGIE = readFileSync(path.resolve(__dirname, "../../public/sw-strategie.js"), "utf8");
const ORIGINE = "https://edutech.test";

// ── CacheStorage minimal en mémoire ──────────────────────────────────────────

class CacheMemoire {
  entrees = new Map<string, Response>();
  private cle(r: Request | string) {
    return new URL(typeof r === "string" ? r : r.url, ORIGINE).href;
  }
  async match(r: Request | string) {
    const rep = this.entrees.get(this.cle(r));
    return rep ? rep.clone() : undefined;
  }
  async put(r: Request | string, rep: Response) {
    this.entrees.set(this.cle(r), rep.clone());
  }
  async addAll(liste: string[]) {
    for (const u of liste) this.entrees.set(this.cle(u), new Response(`precache ${u}`));
  }
  async delete(r: Request | string) {
    return this.entrees.delete(this.cle(r));
  }
}

class CachesMemoire {
  caches = new Map<string, CacheMemoire>();
  async open(nom: string) {
    if (!this.caches.has(nom)) this.caches.set(nom, new CacheMemoire());
    return this.caches.get(nom)!;
  }
  async keys() {
    return [...this.caches.keys()];
  }
  async delete(nom: string) {
    return this.caches.delete(nom);
  }
  async match(r: Request | string) {
    for (const c of this.caches.values()) {
      const rep = await c.match(r);
      if (rep) return rep;
    }
    return undefined;
  }
  /** Toutes les URL mises en cache, tous caches confondus (hors méta). */
  async toutesLesUrls(prefixe = "edutech-donnees-") {
    const urls: string[] = [];
    for (const [nom, c] of this.caches) if (nom.startsWith(prefixe)) urls.push(...c.entrees.keys());
    return urls;
  }
}

// ── Environnement du service worker ──────────────────────────────────────────

type Gestionnaire = (event: unknown) => void;

function chargerServiceWorker() {
  const gestionnaires: Record<string, Gestionnaire> = {};
  const caches = new CachesMemoire();
  const fetch = vi.fn<(r: Request) => Promise<Response>>();
  const messagesClients: unknown[] = [];
  const self = {
    location: { href: `${ORIGINE}/sw.js?v=test`, origin: ORIGINE },
    addEventListener: (type: string, fn: Gestionnaire) => (gestionnaires[type] = fn),
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(async () => {}),
      matchAll: vi.fn(async () => [{ postMessage: (m: unknown) => messagesClients.push(m) }]),
    },
    EdutechStrategie: undefined as unknown,
  };
  const importScripts = () => new Function("self", SOURCE_STRATEGIE)(self);
  new Function("self", "caches", "fetch", "importScripts", "Response", "Request", "URL", SOURCE_SW)(
    self, caches, fetch, importScripts, Response, Request, URL
  );

  async function evenement(type: string, init: Record<string, unknown>) {
    const enAttente: Promise<unknown>[] = [];
    let reponse: Promise<Response> | undefined;
    const event = {
      ...init,
      waitUntil: (p: Promise<unknown>) => enAttente.push(p),
      respondWith: (p: Promise<Response>) => (reponse = p),
    };
    gestionnaires[type](event);
    await Promise.all(enAttente);
    return reponse;
  }

  /** Requête GET de page (navigation) ou d'API ; renvoie undefined si non interceptée. */
  async function requete(chemin: string, init: RequestInit & { navigation?: boolean } = {}) {
    const { navigation, ...reste } = init;
    const req = new Request(`${ORIGINE}${chemin}`, reste);
    if (navigation) Object.defineProperty(req, "mode", { value: "navigate" });
    const rep = await evenement("fetch", { request: req });
    if (rep) {
      const resultat = await rep;
      await new Promise((r) => setTimeout(r, 0)); // laisse finir les écritures en cache
      return resultat;
    }
    return undefined;
  }

  async function message(data: Record<string, unknown>) {
    let reponse: unknown;
    await evenement("message", { data, ports: [{ postMessage: (v: unknown) => (reponse = v) }] });
    await new Promise((r) => setTimeout(r, 0));
    return reponse;
  }

  return { self, caches, fetch, evenement, requete, message, messagesClients };
}

function reponse(corps: string, init: ResponseInit & { url?: string; redirected?: boolean } = {}) {
  const r = new Response(corps, { status: 200, ...init });
  Object.defineProperty(r, "type", { value: "basic" });
  if (init.url) Object.defineProperty(r, "url", { value: init.url });
  if (init.redirected) Object.defineProperty(r, "redirected", { value: true });
  return r;
}

const horsLigne = () => Promise.reject(new TypeError("Failed to fetch"));

// ── Choix de stratégie par URL ───────────────────────────────────────────────

describe("choisirStrategie", () => {
  const env = { EdutechStrategie: undefined as unknown as { choisirStrategie: (r: object) => string } };
  new Function("self", SOURCE_STRATEGIE)(env);
  const choisir = (chemin: string, opts: { method?: string; mode?: string; entetes?: Record<string, string>; origine?: string } = {}) =>
    env.EdutechStrategie.choisirStrategie({
      url: (opts.origine ?? ORIGINE) + chemin,
      method: opts.method ?? "GET",
      mode: opts.mode,
      origine: ORIGINE,
      entete: (n: string) => opts.entetes?.[n.toLowerCase()] ?? null,
    });

  it.each([
    "/_next/static/chunks/main-abc123.js",
    "/_next/static/css/app.css",
    "/_next/static/media/jakarta.woff2",
    "/_next/image?url=%2Farmoiries-benin.png&w=96&q=75",
    "/armoiries-benin.png",
    "/icons/icon-192.png",
    "/manifest.webmanifest",
    "/hors-ligne.html",
  ])("statique (cache d'abord) : %s", (chemin) => {
    expect(choisir(chemin)).toBe("statique");
  });

  it.each([
    "/enseignant",
    "/directeur",
    "/admin/alertes?niveau=eleve",
    "/enseignant/etudiants/abc",
  ])("page (réseau d'abord) : %s", (chemin) => {
    expect(choisir(chemin, { mode: "navigate" })).toBe("page");
  });

  it.each([
    "/api/etudiants?niveau=Seconde%20C",
    "/api/etudiants/abc",
    "/api/notes?etudiantId=abc",
    "/api/absences",
    "/api/alertes?statut=active",
    "/api/inscriptions?etudiantId=abc",
    "/api/etablissements",
    "/api/admin/stats/etablissements",
  ])("API de lecture (réseau d'abord) : %s", (chemin) => {
    expect(choisir(chemin)).toBe("api");
  });

  it.each(["POST", "PATCH", "PUT", "DELETE"])("%s n'est jamais intercepté", (method) => {
    expect(choisir("/api/notes", { method })).toBe("reseau");
    expect(choisir("/api/alertes/abc", { method })).toBe("reseau");
    expect(choisir("/enseignant", { method, mode: "navigate" })).toBe("reseau");
  });

  it.each([
    ["/api/auth/session", {}],
    ["/api/auth/callback/credentials", {}],
    ["/login", { mode: "navigate" }],
    ["/api/alertes/pdf?statut=toutes", {}],
    ["/api/etudiants/abc/pdf", {}],
    ["/sw.js?v=1", {}],
    ["/sw-strategie.js?v=1", {}],
  ])("jamais en cache : %s", (chemin, opts) => {
    expect(choisir(chemin, opts)).toBe("reseau");
  });

  it("charges utiles RSC et préchargements du routeur : non mis en cache", () => {
    expect(choisir("/enseignant?_rsc=x1y2", { mode: "cors" })).toBe("reseau");
    expect(choisir("/enseignant", { entetes: { rsc: "1" } })).toBe("reseau");
    expect(choisir("/enseignant", { entetes: { "next-router-prefetch": "1" } })).toBe("reseau");
  });

  it("autres routes d'API (assistant, profil, historique…) : non mises en cache", () => {
    expect(choisir("/api/profil")).toBe("reseau");
    expect(choisir("/api/admin/historique")).toBe("reseau");
    expect(choisir("/api/notifications/alertes")).toBe("reseau");
  });

  it("autre origine : non interceptée", () => {
    expect(choisir("/x.js", { origine: "https://cdn.example.com" })).toBe("reseau");
  });
});

// ── Comportement du service worker ───────────────────────────────────────────

describe("service worker", () => {
  let sw: ReturnType<typeof chargerServiceWorker>;
  beforeEach(async () => {
    sw = chargerServiceWorker();
    await sw.evenement("install", {});
  });

  it("met en cache la page hors ligne à l'installation", async () => {
    expect(await sw.caches.match(`${ORIGINE}/hors-ligne.html`)).toBeDefined();
  });

  it("les écritures ne passent jamais par le service worker", async () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      expect(await sw.requete("/api/notes", { method, body: method === "DELETE" ? undefined : "{}" })).toBeUndefined();
    }
    expect(sw.fetch).not.toHaveBeenCalled();
  });

  it("fichiers statiques : cache d'abord (un seul appel réseau)", async () => {
    sw.fetch.mockResolvedValue(reponse("js"));
    await sw.requete("/_next/static/chunks/app.js");
    const deuxieme = await sw.requete("/_next/static/chunks/app.js");
    expect(await deuxieme!.text()).toBe("js");
    expect(sw.fetch).toHaveBeenCalledTimes(1);
  });

  it("sans utilisateur identifié, rien n'est mis en cache ni servi depuis le cache", async () => {
    sw.fetch.mockResolvedValueOnce(reponse('[{"id":"e1"}]'));
    await sw.requete("/api/etudiants");
    expect(await sw.caches.toutesLesUrls()).toEqual([]);
    sw.fetch.mockImplementationOnce(horsLigne);
    const rep = await sw.requete("/api/etudiants");
    expect(rep!.status).toBe(503);
  });

  it("API de lecture : réseau d'abord, puis la dernière réponse hors ligne", async () => {
    await sw.message({ type: "UTILISATEUR", id: "prof-a" });
    sw.fetch.mockResolvedValueOnce(reponse('[{"id":"e1"}]'));
    await sw.requete("/api/etudiants");
    sw.fetch.mockImplementationOnce(horsLigne);
    const rep = await sw.requete("/api/etudiants");
    expect(await rep!.json()).toEqual([{ id: "e1" }]);
    expect(sw.messagesClients).toContainEqual({ type: "RESEAU", horsLigne: true });
  });

  it("page jamais visitée hors ligne : page hors ligne", async () => {
    await sw.message({ type: "UTILISATEUR", id: "prof-a" });
    sw.fetch.mockImplementationOnce(horsLigne);
    const rep = await sw.requete("/enseignant/alertes", { navigation: true });
    expect(await rep!.text()).toBe("precache /hors-ligne.html");
  });

  it("ne met en cache ni les redirections ni les PDF ni les erreurs", async () => {
    await sw.message({ type: "UTILISATEUR", id: "prof-a" });
    sw.fetch.mockResolvedValueOnce(reponse("login", { redirected: true, url: `${ORIGINE}/login` }));
    await sw.requete("/enseignant", { navigation: true });
    sw.fetch.mockResolvedValueOnce(reponse("%PDF", { headers: { "Content-Type": "application/pdf" } }));
    await sw.requete("/api/etudiants/e1");
    sw.fetch.mockResolvedValueOnce(reponse("{}", { status: 500 }));
    await sw.requete("/api/notes");
    expect(await sw.caches.toutesLesUrls()).toEqual([]);
  });

  it("déconnexion : tous les caches de données sont vidés", async () => {
    await sw.message({ type: "UTILISATEUR", id: "prof-a" });
    sw.fetch.mockResolvedValueOnce(reponse('[{"id":"secret"}]'));
    await sw.requete("/api/alertes");
    expect(await sw.caches.toutesLesUrls()).not.toEqual([]);

    expect(await sw.message({ type: "DECONNEXION" })).toEqual({ ok: true });
    expect(await sw.caches.toutesLesUrls()).toEqual([]);
    expect(await sw.caches.toutesLesUrls("edutech-meta")).toEqual([]);

    // Plus rien n'est servi depuis le cache, même pour la même URL
    sw.fetch.mockImplementationOnce(horsLigne);
    expect((await sw.requete("/api/alertes"))!.status).toBe(503);
    // La page hors ligne est remise en place
    expect(await sw.caches.match(`${ORIGINE}/hors-ligne.html`)).toBeDefined();
  });

  it("changement de compte : les données de l'ancien compte ne sont jamais servies", async () => {
    await sw.message({ type: "UTILISATEUR", id: "prof-a" });
    sw.fetch.mockResolvedValueOnce(reponse('[{"id":"eleve-de-a"}]'));
    await sw.requete("/api/etudiants");
    sw.fetch.mockResolvedValueOnce(reponse("<html>page de A</html>", { headers: { "Content-Type": "text/html" } }));
    await sw.requete("/enseignant", { navigation: true });

    await sw.message({ type: "UTILISATEUR", id: "directeur-b" });
    expect(await sw.caches.toutesLesUrls()).toEqual([]);

    sw.fetch.mockImplementation(horsLigne);
    expect((await sw.requete("/api/etudiants"))!.status).toBe(503);
    expect(await (await sw.requete("/enseignant", { navigation: true }))!.text()).toBe("precache /hors-ligne.html");
  });

  it("une réponse arrivée après un changement de compte n'est pas rangée chez le nouveau", async () => {
    await sw.message({ type: "UTILISATEUR", id: "prof-a" });
    let livrer!: (r: Response) => void;
    sw.fetch.mockImplementationOnce(() => new Promise((r) => (livrer = r)));
    const enCours = sw.requete("/api/etudiants");
    await sw.message({ type: "UTILISATEUR", id: "directeur-b" });
    livrer(reponse('[{"id":"eleve-de-a"}]'));
    await enCours;
    await new Promise((r) => setTimeout(r, 0));
    const urlsDeB = [...((await sw.caches.open("edutech-donnees-directeur-b")).entrees.keys())];
    expect(urlsDeB).toEqual([]);
  });

  it("lancement hors ligne sur « / » : redirige vers l'accueil de l'espace", async () => {
    await sw.message({ type: "UTILISATEUR", id: "prof-a", accueil: "/enseignant" });
    sw.fetch.mockImplementation(horsLigne);
    const rep = await sw.requete("/", { navigation: true });
    expect(rep!.status).toBe(302);
    expect(rep!.headers.get("location")).toBe(`${ORIGINE}/enseignant`);
  });

  it("MEMORISER_PAGE : garde une copie HTML d'une page visitée côté client", async () => {
    await sw.message({ type: "UTILISATEUR", id: "prof-a" });
    sw.fetch.mockResolvedValueOnce(reponse("<html>alertes</html>", { headers: { "Content-Type": "text/html" } }));
    await sw.message({ type: "MEMORISER_PAGE", url: `${ORIGINE}/enseignant/alertes` });
    sw.fetch.mockImplementation(horsLigne);
    const rep = await sw.requete("/enseignant/alertes", { navigation: true });
    expect(await rep!.text()).toBe("<html>alertes</html>");
  });

  it("MEMORISER_PAGE ignore /login et les autres origines", async () => {
    await sw.message({ type: "UTILISATEUR", id: "prof-a" });
    await sw.message({ type: "MEMORISER_PAGE", url: `${ORIGINE}/login` });
    await sw.message({ type: "MEMORISER_PAGE", url: "https://autre.example/enseignant" });
    expect(sw.fetch).not.toHaveBeenCalled();
  });

  it("une nouvelle version attend l'accord de l'utilisateur (SKIP_WAITING)", async () => {
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    await sw.message({ type: "SKIP_WAITING" });
    expect(sw.self.skipWaiting).toHaveBeenCalledOnce();
  });
});

// ── Vidage depuis la page (déconnexion / connexion) ──────────────────────────

describe("viderCachesPwa", () => {
  it("supprime tous les caches de l'application et prévient le service worker", async () => {
    const stockage = new CachesMemoire();
    await stockage.open("edutech-donnees-prof-a");
    await stockage.open("edutech-statique-1");
    await stockage.open("edutech-meta");
    await stockage.open("autre-application");
    vi.stubGlobal("caches", stockage);
    const postMessage = vi.fn((_m: unknown, ports?: MessagePort[]) => ports?.[0]?.postMessage({ ok: true }));
    vi.stubGlobal("navigator", {
      serviceWorker: { controller: { postMessage }, ready: Promise.resolve({ active: null }) },
    });

    const { viderCachesPwa } = await import("@/lib/pwa");
    await viderCachesPwa();

    expect(await stockage.keys()).toEqual(["autre-application"]);
    expect(postMessage).toHaveBeenCalledWith({ type: "DECONNEXION" }, expect.any(Array));
    vi.unstubAllGlobals();
  });

  it("empreinteUtilisateur : stable et différente d'un compte à l'autre", async () => {
    const { empreinteUtilisateur } = await import("@/lib/pwa");
    expect(empreinteUtilisateur("prof@edutech.bj")).toBe(empreinteUtilisateur("prof@edutech.bj"));
    expect(empreinteUtilisateur("prof@edutech.bj")).not.toBe(empreinteUtilisateur("dir@edutech.bj"));
    expect(empreinteUtilisateur("prof@edutech.bj")).not.toContain("@");
  });
});
