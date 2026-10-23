import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

const { grouperNotesParAnnee, grouperParAnnee, moyenneNotes, moyennesChronologiques, libelleCourt, libellePeriode, TRIMESTRES } =
  await import("@/lib/notes-trimestres");
const { AccordeonTrimestres } = await import("@/components/notes/AccordeonTrimestres");
const { accueilDuRole } = await import("@/lib/accueil");
const { hauteurGraphiqueBarres } = await import("@/lib/graphiques");
const { default: NotFound } = await import("@/app/(fr)/(espaces)/not-found");

const EN_COURS = { anneeScolaire: "2026-2027", periode: "Trimestre 1" };
const note = (id: string, periode: string, valeur: number, matiere = "Maths", anneeScolaire = "2025-2026") => ({
  id,
  periode,
  valeur,
  matiere,
  anneeScolaire,
});

/** Texte d'un arbre d'éléments React non rendu (composants serveur). */
function texte(noeud: ReactNode): string {
  if (noeud === null || noeud === undefined || typeof noeud === "boolean") return "";
  if (typeof noeud === "string" || typeof noeud === "number") return String(noeud);
  if (Array.isArray(noeud)) return noeud.map(texte).join("");
  if (isValidElement(noeud)) return texte((noeud as ReactElement<{ children?: ReactNode }>).props.children);
  return "";
}

/** Valeurs de la prop `src` des éléments de l'arbre. */
function sources(noeud: ReactNode): string[] {
  if (Array.isArray(noeud)) return noeud.flatMap(sources);
  if (!isValidElement(noeud)) return [];
  const props = noeud.props as { src?: unknown; children?: ReactNode };
  return [...(typeof props.src === "string" ? [props.src] : []), ...sources(props.children)];
}

/** Premier élément de l'arbre qui a la prop `href`. */
function lien(noeud: ReactNode): { href: string; texte: string } | null {
  if (Array.isArray(noeud)) {
    for (const enfant of noeud) {
      const trouve = lien(enfant);
      if (trouve) return trouve;
    }
    return null;
  }
  if (!isValidElement(noeud)) return null;
  const props = noeud.props as { href?: string; children?: ReactNode };
  if (typeof props.href === "string") return { href: props.href, texte: texte(props.children).trim() };
  return lien(props.children);
}

// ── Notes par année puis par trimestre ───────────────────────────────────────

describe("notes-trimestres", () => {
  const notes = [
    note("a", "Trimestre 2", 12),
    note("b", "Trimestre 1", 8),
    note("c", "Trimestre 2", 15),
    note("d", "Trimestre 1", 4, "SVT", "2026-2027"),
  ];

  it("une année par bloc, la plus récente d'abord, chacune avec ses trois trimestres dans l'ordre", () => {
    const annees = grouperNotesParAnnee(notes, "2026-2027");
    expect(annees.map((a) => a.anneeScolaire)).toEqual(["2026-2027", "2025-2026"]);
    expect(annees.every((a) => a.trimestres.map((t) => t.periode).join() === TRIMESTRES.join())).toBe(true);
    expect(annees[1].trimestres.map((t) => t.notes.map((n) => n.id))).toEqual([["b"], ["a", "c"], []]);
    expect(annees[1].trimestres.map((t) => t.moyenne)).toEqual([8, 13.5, null]);
  });

  it("deux « Trimestre 1 » d'années différentes ne sont jamais mélangés", () => {
    const [recente, ancienne] = grouperNotesParAnnee(notes, "2026-2027");
    expect(recente.trimestres[0].notes.map((n) => n.id)).toEqual(["d"]);
    expect(ancienne.trimestres[0].notes.map((n) => n.id)).toEqual(["b"]);
    expect(recente.moyenne).toBe(4);
    expect(ancienne.moyenne).toBeCloseTo(35 / 3);
  });

  it("l'année en cours est toujours présente, même sans note ; aucune note : elle seule", () => {
    expect(grouperNotesParAnnee([note("a", "Trimestre 3", 12)], "2026-2027").map((a) => a.anneeScolaire)).toEqual(["2026-2027", "2025-2026"]);
    const vide = grouperNotesParAnnee([], "2026-2027");
    expect(vide).toHaveLength(1);
    expect(vide[0]).toMatchObject({ anneeScolaire: "2026-2027", moyenne: null });
  });

  it("absences : même regroupement par année puis par trimestre", () => {
    const abs = [{ periode: "Trimestre 1", anneeScolaire: "2025-2026" }, { periode: "Trimestre 1", anneeScolaire: "2026-2027" }];
    const groupes = grouperParAnnee(abs, "2026-2027");
    expect(groupes.map((g) => [g.anneeScolaire, g.trimestres[0].elements.length])).toEqual([["2026-2027", 1], ["2025-2026", 1]]);
  });

  it("graphiques : un point par trimestre et par année, dans l'ordre chronologique", () => {
    const points = moyennesChronologiques(notes);
    expect(points.map((p) => libelleCourt(p, true))).toEqual(["T1 ·\u00a025-26", "T2 ·\u00a025-26", "T1 ·\u00a026-27"]);
    expect(points.map((p) => p.moyenne)).toEqual([8, 13.5, 4]);
    expect(libelleCourt(points[0], false)).toBe("T1");
    expect(libellePeriode("Trimestre 1", "2026-2027")).toBe("Trimestre\u00a01 ·\u00a02026-2027");
    expect(libellePeriode("Trimestre 1", null)).toBe("Trimestre\u00a01");
  });

  it("moyenne : null sans note", () => {
    expect(moyenneNotes([])).toBeNull();
    expect(moyenneNotes([{ valeur: 10 }, { valeur: 13 }])).toBe(11.5);
  });
});

// ── Accordéon (rendu serveur, celui que reçoit le navigateur) ────────────────

describe("AccordeonTrimestres", () => {
  const annees = grouperNotesParAnnee(
    [
      note("a", "Trimestre 1", 8, "Anglais"),
      note("b", "Trimestre 1", 12, "SVT"),
      note("c", "Trimestre 2", 14.5, "Français"),
      note("d", "Trimestre 1", 9, "SVT", "2026-2027"),
    ],
    EN_COURS.anneeScolaire
  );
  const html = renderToStaticMarkup(<AccordeonTrimestres annees={annees} enCours={EN_COURS} />);
  const boutons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  const attribut = (balise: string, nom: string) => balise.match(new RegExp(`${nom}="([^"]*)"`))?.[1];

  it("une année par titre h3, la plus récente d'abord, marquée « en cours »", () => {
    const titres = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
    expect(titres).toEqual(["Année scolaire 2026-2027(en cours)", "Année scolaire 2025-2026"]);
    expect(html).toContain("Moyenne annuelle : 9,0/20");
  });

  it("un bouton par trimestre et par année, de type button, dans un titre h4", () => {
    expect(boutons).toHaveLength(6);
    expect(boutons.every((b) => attribut(b, "type") === "button")).toBe(true);
    expect(html.match(/<h4><button/g)).toHaveLength(6);
  });

  it("seul le trimestre en cours (T1 2026-2027) est ouvert, pas le T1 de l'année précédente", () => {
    expect(boutons.map((b) => attribut(b, "aria-expanded"))).toEqual(["true", "false", "false", "false", "false", "false"]);
    expect(attribut(boutons[0], "data-entete-trimestre")).toBe("2026-2027::Trimestre 1");
  });

  it("aria-controls désigne le panneau, qui est étiqueté par son bouton et masqué s'il est replié", () => {
    for (const bouton of boutons) {
      const idPanneau = attribut(bouton, "aria-controls")!;
      const panneau = html.match(new RegExp(`<div id="${idPanneau}"[^>]*>`))?.[0];
      expect(panneau).toBeDefined();
      expect(attribut(panneau!, "role")).toBe("region");
      expect(attribut(panneau!, "aria-labelledby")).toBe(attribut(bouton, "id"));
      expect(panneau!.includes("hidden")).toBe(attribut(bouton, "aria-expanded") === "false");
    }
  });

  it("la moyenne reste dans l'en-tête d'un trimestre replié", () => {
    const enteteT1Passe = html.slice(html.indexOf(boutons[3]), html.indexOf("</button>", html.indexOf(boutons[3])));
    expect(enteteT1Passe).toContain("Moyenne : </span>10,0/20");
    expect(enteteT1Passe).toContain("2 notes");
  });

  it("trimestre sans note : pas de moyenne dans l'en-tête, message dans le panneau", () => {
    expect(html).toContain("Pas de moyenne");
    expect(html).toContain("Aucune note pour cette période.");
  });

  it("notes colorées selon le seuil de 10/20, ou neutres dans l'espace étudiant", () => {
    expect(html).toContain("bg-red-50 text-red-800");
    expect(html).toContain("bg-emerald-50 text-emerald-800");
    const neutre = renderToStaticMarkup(<AccordeonTrimestres annees={annees} enCours={EN_COURS} notesColorees={false} />);
    expect(neutre).not.toContain("bg-red-50");
  });

  it("identifiants uniques quand deux accordéons sont sur la même page", () => {
    const double = renderToStaticMarkup(
      <>
        <AccordeonTrimestres annees={annees} enCours={EN_COURS} />
        <AccordeonTrimestres annees={annees} enCours={EN_COURS} />
      </>
    );
    const ids = [...double.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── Page 404 ─────────────────────────────────────────────────────────────────

describe("Page introuvable", () => {
  it.each([
    ["admin", "/admin"],
    ["directeur", "/directeur"],
    ["enseignant", "/enseignant"],
    ["etudiant", "/etudiant"],
  ])("connecté en %s : le bouton ramène à %s", async (role, accueil) => {
    mockAuth.mockResolvedValue({ user: { role } });
    const page = await NotFound();
    expect(lien(page)).toEqual({ href: accueil, texte: "Retour à mon espace" });
  });

  it("non connecté : le bouton ramène à /", async () => {
    mockAuth.mockResolvedValue(null);
    expect(lien(await NotFound())).toEqual({ href: "/", texte: "Retour à l'accueil" });
  });

  it("session illisible : la page s'affiche quand même, avec un retour à /", async () => {
    mockAuth.mockImplementation(async () => {
      throw new Error("JWT invalide");
    });
    expect(lien(await NotFound())).toEqual({ href: "/", texte: "Retour à l'accueil" });
  });

  it("titre « Page introuvable », armoiries, texte identique quel que soit le rôle", async () => {
    mockAuth.mockResolvedValue({ user: { role: "enseignant" } });
    const prof = await NotFound();
    mockAuth.mockResolvedValue({ user: { role: "directeur" } });
    const directeur = await NotFound();
    expect(texte(prof)).toContain("Page introuvable");
    expect(sources(prof)).toContain("/armoiries-benin.png");
    // Ni nom d'élève ni indice sur l'existence de la fiche : seul le libellé du bouton dépend du compte
    expect(texte(prof).replace(/\s+/g, " ")).toBe(texte(directeur).replace(/\s+/g, " "));
  });

  it("accueilDuRole : null pour un rôle inconnu ou absent", () => {
    expect(accueilDuRole("inspecteur")).toBeNull();
    expect(accueilDuRole(undefined)).toBeNull();
    expect(accueilDuRole("")).toBeNull();
  });
});

// ── Squelettes de chargement ─────────────────────────────────────────────────

const SQUELETTES: Record<string, string> = {
  "admin (tableau de bord)": "@/app/(fr)/(espaces)/admin/loading",
  directeur: "@/app/(fr)/(espaces)/directeur/loading",
  "enseignant (élèves)": "@/app/(fr)/(espaces)/enseignant/loading",
  etudiant: "@/app/(fr)/(espaces)/etudiant/loading",
  "admin, élèves": "@/app/(fr)/(espaces)/admin/etudiants/loading",
  "admin, alertes": "@/app/(fr)/(espaces)/admin/alertes/loading",
  "directeur, alertes": "@/app/(fr)/(espaces)/directeur/alertes/loading",
  "enseignant, alertes": "@/app/(fr)/(espaces)/enseignant/alertes/loading",
  "admin, absences": "@/app/(fr)/(espaces)/admin/absences/loading",
  "directeur, absences": "@/app/(fr)/(espaces)/directeur/absences/loading",
  "enseignant, absences": "@/app/(fr)/(espaces)/enseignant/absences/loading",
  "admin, historique": "@/app/(fr)/(espaces)/admin/historique/loading",
  "admin, utilisateurs": "@/app/(fr)/(espaces)/admin/utilisateurs/loading",
  "admin, nouveau compte": "@/app/(fr)/(espaces)/admin/utilisateurs/nouveau/loading",
  "admin, fiche élève": "@/app/(fr)/(espaces)/admin/etudiants/[id]/loading",
  "enseignant, fiche élève": "@/app/(fr)/(espaces)/enseignant/etudiants/[id]/loading",
};

describe("Squelettes de chargement", () => {
  it.each(Object.entries(SQUELETTES))("%s : squelette animé, annoncé, sans titre ni spinner", async (_, chemin) => {
    const { default: Chargement } = await import(/* @vite-ignore */ chemin);
    const html = renderToStaticMarkup(<Chargement />);
    expect(html).toMatch(/^<main[^>]*aria-busy="true"/);
    // Annonce pour les lecteurs d'écran
    expect(html).toMatch(/<p role="status" class="sr-only">Chargement[^<]*…<\/p>/);
    // Pas de h1 : les tests navigateur attendent « main h1 » pour savoir que la vraie page est là
    expect(html).not.toMatch(/<h[1-6]/);
    expect(html).not.toMatch(/animate-spin|animate-pulse/);
    const blocs = [...html.matchAll(/<div[^>]*class="squelette[ "][^>]*>/g)].map((m) => m[0]);
    expect(blocs.length).toBeGreaterThan(10);
    expect(blocs.every((b) => b.includes('aria-hidden="true"'))).toBe(true);
  });

  it("fiches et espace étudiant : les notes ont la forme de l'accordéon (3 en-têtes, le dernier ouvert)", async () => {
    for (const chemin of ["@/app/(fr)/(espaces)/etudiant/loading", "@/app/(fr)/(espaces)/admin/etudiants/[id]/loading", "@/app/(fr)/(espaces)/enseignant/etudiants/[id]/loading"]) {
      const { default: Chargement } = await import(/* @vite-ignore */ chemin);
      const html = renderToStaticMarkup(<Chargement />);
      expect(html.match(/min-h-14 items-center justify-between gap-3 bg-ink/g), chemin).toHaveLength(3);
    }
  });

  const css = readFileSync(path.join(__dirname, "..", "app", "globals.css"), "utf8");

  it("prefers-reduced-motion : l'animation des squelettes est coupée", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.squelette,\s*\.squelette-trace\s*\{\s*animation: none;/);
  });

  it("contraste élevé : blocs gris foncé visibles sur le fond clair, sans pulsation", () => {
    const regle = css.match(/html\[data-theme="high-contrast"\] \.squelette \{([^}]*)\}/)?.[1] ?? "";
    expect(regle).toContain("background-color: #767676");
    expect(regle).toContain("animation: none");
    expect(css).toMatch(/@media \(forced-colors: active\)\s*\{\s*\.squelette/);
  });

  it("graphiques en barres : même hauteur pour le squelette et le graphique", () => {
    expect(hauteurGraphiqueBarres(0)).toBe(48);
    expect(hauteurGraphiqueBarres(5)).toBe(5 * 52 + 48);
  });
});
