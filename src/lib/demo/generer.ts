/**
 * Données de démonstration : établissements, élèves, notes, absences, alertes
 * et historique, sans accès à la base (testable). prisma/seed.ts les écrit.
 *
 * Tirages pseudo-aléatoires à graine fixe : mêmes établissements, mêmes élèves
 * et mêmes identifiants à chaque exécution. Les périodes dépendent de la date
 * passée en paramètre : l'année précédente complète, puis l'année en cours
 * jusqu'au trimestre du jour, où seules les semaines écoulées ont des notes.
 *
 * Les alertes sont calculées avec les règles de l'application
 * (src/lib/regles-alerte.ts) : seuls les cas voulus en déclenchent une.
 */

import { periodeScolaireAuBenin } from "@/lib/annee-scolaire";
import { FUSEAU_BENIN, jourIsoAuBenin } from "@/lib/dates";
import { matieresDuNiveau } from "@/lib/programme";
import { comparerMoyennes, comparerPeriodes, compterAbsencesRecentes } from "@/lib/regles-alerte";
import { NOMS, PRENOMS_COURANTS, PRENOMS_LOCAUX, PRENOMS_MUSULMANS, REPARTITION_PRENOMS, type Groupe } from "./noms";

// ── Types ────────────────────────────────────────────────────────────────────

export type PeriodeRef = { anneeScolaire: string; periode: string };
type Sexe = "F" | "M";
type Niveau = "eleve" | "moyen";

export type EtablissementDemo = { id: string; nom: string; departement: string; commune: string; statut: "public" | "privé" };
export type EtudiantDemo = {
  id: string;
  nom: string;
  prenom: string;
  sexe: Sexe;
  dateNaissance: Date;
  etablissementId: string;
  niveau: string;
};
export type InscriptionDemo = { id: string; etudiantId: string; anneeScolaire: string; niveau: string; statut: string };
export type NoteDemo = PeriodeRef & { id: string; etudiantId: string; matiere: string; valeur: number; createdAt: Date };
export type AbsenceDemo = PeriodeRef & {
  id: string;
  etudiantId: string;
  date: Date;
  motif: "injustifiee" | "justifiee";
  createdAt: Date;
};
export type AlerteDemo = PeriodeRef & {
  id: string;
  etudiantId: string;
  type: "baisse_moyenne" | "absences";
  niveauRisque: Niveau;
  moyenneAvant: number;
  moyenneApres: number;
  ecartPourcent: number;
  statut: "active";
  createdAt: Date;
  niveauModifieLe: Date | null;
};
export type JournalDemo = {
  id: string;
  action: "NOTE_CREEE" | "ABSENCE_CREEE";
  description: string;
  entityType: "note" | "absence";
  entityId: string;
  createdAt: Date;
};
export type RoleCompte = "admin" | "enseignant" | "directeur" | "etudiant";
export type CompteDemo = { nom: string; prenom: string; etablissementId: string | null; etudiantId: string | null };

export type CleCas = "chute" | "baisse" | "absences" | "aggravation" | "nouveau" | "compteEtudiant";

export type DonneesDemo = {
  enCours: PeriodeRef;
  periodes: PeriodeRef[];
  etablissements: EtablissementDemo[];
  etudiants: EtudiantDemo[];
  inscriptions: InscriptionDemo[];
  notes: NoteDemo[];
  absences: AbsenceDemo[];
  alertes: AlerteDemo[];
  /** Historique des saisies du trimestre en cours dans l'établissement de la démo (par l'enseignant) */
  journal: JournalDemo[];
  comptes: Record<RoleCompte, CompteDemo>;
  cas: Record<CleCas, EtudiantDemo>;
  /** Situations dégradées à signaler (début de trimestre : peu de jours de classe écoulés) */
  avertissements: string[];
};

// ── Paramètres ───────────────────────────────────────────────────────────────

const GRAINE = 20261021;

const PREMIER_CYCLE = ["6ème", "5ème", "4ème", "3ème"];

type DefinitionEtablissement = Omit<EtablissementDemo, "id"> & {
  effectif: number;
  groupes: Partial<Record<Groupe, number>>;
  classes: string[];
};

/** Noms inventés, vérifiés : aucun établissement connu ne les porte (octobre 2026). */
const ETABLISSEMENTS: DefinitionEtablissement[] = [
  {
    nom: "CEG Zopah", departement: "Atlantique", commune: "Abomey-Calavi", statut: "public", effectif: 46,
    groupes: { fon: 0.55, goun: 0.1, yoruba: 0.1, adja: 0.1, mina: 0.05, bariba: 0.05, dendi: 0.05 },
    classes: [...PREMIER_CYCLE, "Seconde A", "Seconde C", "Seconde D", "Première A1", "Première C", "Première D", "Terminale A1", "Terminale C", "Terminale D"],
  },
  {
    nom: "Complexe scolaire Les Bâtisseurs", departement: "Littoral", commune: "Cotonou", statut: "privé", effectif: 34,
    groupes: { fon: 0.35, goun: 0.15, yoruba: 0.15, mina: 0.1, adja: 0.1, bariba: 0.08, dendi: 0.07 },
    classes: [...PREMIER_CYCLE, "Seconde A", "Seconde B", "Seconde C", "Seconde D", "Première A2", "Première B", "Première C", "Première D", "Terminale A2", "Terminale B", "Terminale C", "Terminale D"],
  },
  {
    nom: "Collège catholique Sainte-Bakhita", departement: "Ouémé", commune: "Porto-Novo", statut: "privé", effectif: 32,
    groupes: { goun: 0.5, yoruba: 0.3, fon: 0.15, mina: 0.05 },
    classes: [...PREMIER_CYCLE, "Seconde A", "Seconde C", "Seconde D", "Première A1", "Première A2", "Première C", "Première D", "Terminale A1", "Terminale A2", "Terminale C", "Terminale D"],
  },
  {
    nom: "CEG Les Rôniers", departement: "Plateau", commune: "Sakété", statut: "public", effectif: 30,
    groupes: { yoruba: 0.75, goun: 0.15, fon: 0.1 },
    classes: [...PREMIER_CYCLE, "Seconde A", "Seconde D", "Première A1", "Première D", "Terminale A1", "Terminale D"],
  },
  {
    nom: "CEG Agongointo", departement: "Zou", commune: "Bohicon", statut: "public", effectif: 33,
    groupes: { fon: 0.85, yoruba: 0.05, adja: 0.05, goun: 0.05 },
    classes: [...PREMIER_CYCLE, "Seconde A", "Seconde C", "Seconde D", "Première A2", "Première C", "Première D", "Terminale A2", "Terminale C", "Terminale D"],
  },
  {
    nom: "CEG Lokogohoué", departement: "Couffo", commune: "Dogbo", statut: "public", effectif: 30,
    groupes: { adja: 0.8, fon: 0.15, mina: 0.05 },
    classes: [...PREMIER_CYCLE, "Seconde A", "Seconde D", "Première A1", "Première D", "Terminale A1", "Terminale D"],
  },
  {
    nom: "CEG Avlo", departement: "Mono", commune: "Grand-Popo", statut: "public", effectif: 30,
    groupes: { mina: 0.55, adja: 0.25, fon: 0.2 },
    classes: [...PREMIER_CYCLE, "Seconde A", "Seconde D", "Première A2", "Première D", "Terminale A2", "Terminale D"],
  },
  {
    nom: "Collège privé La Sagesse", departement: "Borgou", commune: "Parakou", statut: "privé", effectif: 34,
    groupes: { bariba: 0.5, dendi: 0.2, yoruba: 0.1, fon: 0.2 },
    classes: [...PREMIER_CYCLE, "Seconde A", "Seconde B", "Seconde C", "Seconde D", "Première A1", "Première B", "Première C", "Première D", "Terminale A1", "Terminale B", "Terminale C", "Terminale D"],
  },
  {
    nom: "CEG Guéné", departement: "Alibori", commune: "Malanville", statut: "public", effectif: 30,
    groupes: { dendi: 0.7, bariba: 0.25, fon: 0.05 },
    classes: [...PREMIER_CYCLE, "Seconde A", "Seconde D", "Première A1", "Première D", "Terminale A1", "Terminale D"],
  },
];

/** Établissement de la démo : comptes enseignant et directeur, cas choisis. */
const ETABLISSEMENT_DEMO = "CEG Zopah";

export const NOMS_COMPTES: Record<RoleCompte, { nom: string; prenom: string }> = {
  admin: { nom: "Kpadonou", prenom: "Arsène" },
  enseignant: { nom: "Gbaguidi", prenom: "Fulbert" },
  directeur: { nom: "Sossou", prenom: "Bernadette" },
  etudiant: { nom: "Ahouansou", prenom: "Prudence" },
};

type DefinitionCas = {
  prenom: string;
  nom: string;
  sexe: Sexe;
  niveau: string;
  /** Moyenne de la période précédente et de la période en cours (au quart de point) */
  avant: number;
  recente: number;
  /** Nombre de notes de la période en cours (défaut : comme la classe) */
  notesRecentes?: number;
  /** Absences injustifiées de la période en cours, le lundi de préférence */
  absencesInjustifiees?: number;
  /** Arrivé ce trimestre : notes de la période en cours seulement */
  nouveau?: boolean;
};

/**
 * Cas de la démo. Sèna Dossou : 6 notes à 11 contre 13,5 (Moyen). Une note
 * d'au moins 4 la laisse à Moyen ; une deuxième, si les deux font moins de 14
 * (par exemple 6 et 6), fait passer la moyenne sous 10 : Élevé.
 */
export const CAS: Record<CleCas, DefinitionCas> = {
  chute: { prenom: "Rodrigue", nom: "Agossou", sexe: "M", niveau: "Première D", avant: 12.75, recente: 7.5 },
  baisse: { prenom: "Adéola", nom: "Akanni", sexe: "F", niveau: "Terminale C", avant: 14.5, recente: 12 },
  absences: { prenom: "Inoussa", nom: "Maïga", sexe: "M", niveau: "3ème", avant: 11.5, recente: 11.75, absencesInjustifiees: 7 },
  aggravation: { prenom: "Sèna", nom: "Dossou", sexe: "F", niveau: "Seconde D", avant: 13.5, recente: 11, notesRecentes: 6 },
  nouveau: { prenom: "Nafissatou", nom: "Gounou", sexe: "F", niveau: "6ème", avant: 0, recente: 12.5, nouveau: true },
  compteEtudiant: { ...NOMS_COMPTES.etudiant, sexe: "F", niveau: "Terminale D", avant: 14.25, recente: 14.5 },
};

// ── Hasard reproductible ─────────────────────────────────────────────────────

type Alea = () => number;

/** mulberry32 : générateur pseudo-aléatoire à graine. */
function creerAlea(graine: number): Alea {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const choisir = <T,>(liste: readonly T[], alea: Alea): T => liste[Math.floor(alea() * liste.length)];

function melanger<T>(liste: readonly T[], alea: Alea): T[] {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

function normale(alea: Alea, moyenne: number, ecartType: number): number {
  const u = 1 - alea();
  const v = alea();
  return moyenne + ecartType * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function tirerPondere<T extends string>(poids: Partial<Record<T, number>>, alea: Alea): T {
  const entrees = Object.entries(poids) as [T, number][];
  let r = alea() * entrees.reduce((s, [, p]) => s + p, 0);
  for (const [cle, p] of entrees) {
    r -= p;
    if (r < 0) return cle;
  }
  return entrees[entrees.length - 1][0];
}

function creerIdentifiants(graine: number): () => string {
  const alea = creerAlea(graine);
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  return () => "c" + Array.from({ length: 24 }, () => alphabet[Math.floor(alea() * 36)]).join("");
}

/** Arrondi au quart de point, borné entre 0 et 20. */
const auQuart = (valeur: number) => Math.min(20, Math.max(0, Math.round(valeur * 4) / 4));

// ── Calendrier ───────────────────────────────────────────────────────────────
// Jours au format AAAA-MM-JJ, manipulés à midi UTC : simple calcul de
// calendrier, sans fuseau (le jour du Bénin vient de jourIsoAuBenin).

function ajouterJours(jour: string, n: number): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const jourDeLaSemaine = (jour: string) => new Date(`${jour}T12:00:00Z`).getUTCDay();

/** Jours du lundi au vendredi, bornes comprises. */
function joursDeClasse(debut: string, fin: string): string[] {
  const jours: string[] = [];
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) {
    const js = jourDeLaSemaine(j);
    if (js !== 0 && js !== 6) jours.push(j);
  }
  return jours;
}

/** Début officiel (règle de l'application), puis semaines de cours de chaque trimestre. */
function bornesTrimestre({ anneeScolaire, periode }: PeriodeRef) {
  const debut = Number.parseInt(anneeScolaire, 10);
  if (periode === "Trimestre 1") return { officiel: `${debut}-09-01`, debut: `${debut}-09-14`, fin: `${debut}-12-18` };
  if (periode === "Trimestre 2") return { officiel: `${debut + 1}-01-01`, debut: `${debut + 1}-01-05`, fin: `${debut + 1}-03-27` };
  return { officiel: `${debut + 1}-04-01`, debut: `${debut + 1}-04-13`, fin: `${debut + 1}-06-26` };
}

const TRIMESTRES = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];

/** Année précédente complète, puis l'année en cours jusqu'au trimestre du jour. */
export function periodesDeDemo(enCours: PeriodeRef): PeriodeRef[] {
  const debut = Number.parseInt(enCours.anneeScolaire, 10);
  const precedente = `${debut - 1}-${debut}`;
  const rang = TRIMESTRES.indexOf(enCours.periode);
  return [
    ...TRIMESTRES.map((periode) => ({ anneeScolaire: precedente, periode })),
    ...TRIMESTRES.slice(0, rang + 1).map((periode) => ({ anneeScolaire: enCours.anneeScolaire, periode })),
  ];
}

const clePeriode = (p: PeriodeRef) => `${p.anneeScolaire}::${p.periode}`;

// ── Classes et matières ──────────────────────────────────────────────────────

const ORDRE_CYCLE = ["6ème", "5ème", "4ème", "3ème", "Seconde", "Première", "Terminale"];
const rangClasse = (niveau: string) => ORDRE_CYCLE.findIndex((n) => niveau.startsWith(n));

/** Classe de l'année précédente (sans redoublement) ; null : l'élève était en CM2. */
export function classePrecedente(niveau: string): string | null {
  if (niveau === "6ème") return null;
  const rang = rangClasse(niveau);
  if (rang <= 4) return ORDRE_CYCLE[rang - 1]; // 5ème → 6ème … Seconde → 3ème
  const serie = niveau.split(" ")[1];
  if (rang === 5) return `Seconde ${serie.startsWith("A") ? "A" : serie}`;
  return `Première ${serie}`;
}

const LANGUES_VIVANTES = ["Espagnol", "Allemand"];

function matieresDeLEleve(niveau: string, lv2: string): string[] {
  return matieresDuNiveau(niveau).filter((m) => !LANGUES_VIVANTES.includes(m) || m === lv2);
}

/** Points forts et faibles de l'élève selon sa série, plus une part individuelle. */
function profilMatieres(niveau: string, alea: Alea): Record<string, number> {
  const serie = niveau.split(" ")[1] ?? "";
  const profil: Record<string, number> = {};
  for (const m of matieresDuNiveau(niveau)) {
    let decalage = normale(alea, 0, 1.1);
    if (m === "EPS") decalage += 2;
    if (serie === "C" && (m === "Mathématiques" || m === "PCT")) decalage += 0.8;
    if (serie === "D" && m === "SVT") decalage += 0.8;
    if (serie.startsWith("A")) {
      if (["Français", "Philosophie", "Anglais", "Espagnol", "Allemand"].includes(m)) decalage += 0.8;
      if (["Mathématiques", "PCT"].includes(m)) decalage -= 1.2;
    }
    if (serie === "B" && m === "Économie") decalage += 0.8;
    profil[m] = decalage;
  }
  return profil;
}

// ── Génération ───────────────────────────────────────────────────────────────

type Profil = "normal" | "baisse_moyen" | "baisse_eleve" | "absences";

type EleveInterne = {
  etudiant: EtudiantDemo;
  /** Classe de l'année précédente ; null : pas encore au collège (ou nouvel élève) */
  niveauPrecedent: string | null;
  lv2: string;
  base: number;
  profil: Profil;
  cas?: CleCas;
};

export function genererDonneesDemo(maintenant: Date): DonneesDemo {
  const enCours = periodeScolaireAuBenin(maintenant);
  const aujourdhui = jourIsoAuBenin(maintenant);
  const periodes = periodesDeDemo(enCours);
  const periodeRecente = periodes[periodes.length - 1];
  const avertissements: string[] = [];

  // Flux séparés : la date du jour ne change ni les élèves ni leurs identifiants.
  const aleaStructure = creerAlea(GRAINE);
  const aleaNotes = creerAlea(GRAINE + 1);
  const idStructure = creerIdentifiants(GRAINE + 2);
  const idSaisie = creerIdentifiants(GRAINE + 3);

  // Jours de classe de chaque période ; celle en cours s'arrête aujourd'hui.
  const calendrier = new Map<string, { jours: string[]; progression: number }>();
  for (const p of periodes) {
    const b = bornesTrimestre(p);
    const tous = joursDeClasse(b.debut, b.fin);
    if (clePeriode(p) !== clePeriode(periodeRecente)) {
      calendrier.set(clePeriode(p), { jours: tous, progression: 1 });
      continue;
    }
    const passes = tous.filter((j) => j <= aujourdhui);
    if (passes.length > 0) {
      calendrier.set(clePeriode(p), { jours: passes, progression: passes.length / tous.length });
    } else {
      const secours = joursDeClasse(b.officiel, aujourdhui);
      calendrier.set(clePeriode(p), { jours: secours.length > 0 ? secours : [aujourdhui], progression: 0 });
    }
  }
  const joursEnCours = calendrier.get(clePeriode(periodeRecente))!.jours;
  if (joursEnCours.length < 7) {
    avertissements.push(
      `Début de trimestre : ${joursEnCours.length} jour(s) de classe écoulé(s) seulement ; plusieurs notes et absences partagent la même date.`
    );
  }
  const notesParMatiereEnCours = Math.min(3, Math.max(1, Math.round(3 * calendrier.get(clePeriode(periodeRecente))!.progression)));

  /** Horodatage d'une saisie ce jour-là (9 h – 16 h au Bénin), jamais dans le futur. */
  const horodater = (jour: string, alea: Alea) => {
    const heure = 8 + Math.floor(alea() * 7);
    const minute = Math.floor(alea() * 60);
    const date = new Date(`${jour}T${String(heure).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
    return date.getTime() < maintenant.getTime() ? date : new Date(maintenant.getTime() - 60_000);
  };

  // Établissements, élèves, inscriptions
  const etablissements: EtablissementDemo[] = [];
  const eleves: EleveInterne[] = [];
  const nomsPris = new Set(
    [...Object.values(NOMS_COMPTES), ...Object.values(CAS)].map((p) => `${p.nom}|${p.prenom}`)
  );

  const dateDeNaissance = (niveau: string, redoublant: boolean) => {
    const retard = tirerPondere({ "0": 0.6, "1": 0.3, "2": 0.1 }, aleaStructure);
    const age = 11 + rangClasse(niveau) + Number(retard) + (redoublant ? 1 : 0);
    const annee = Number.parseInt(enCours.anneeScolaire, 10) - age - 1;
    return new Date(`${ajouterJours(`${annee}-09-02`, Math.floor(aleaStructure() * 365))}T00:00:00Z`);
  };

  const ajouterEleve = (eleve: Omit<EleveInterne, "etudiant"> & { etudiant: Omit<EtudiantDemo, "id"> }) => {
    const complet = { ...eleve, etudiant: { id: idStructure(), ...eleve.etudiant } };
    eleves.push(complet);
    return complet;
  };

  for (const def of ETABLISSEMENTS) {
    const etab: EtablissementDemo = {
      id: idStructure(),
      nom: def.nom,
      departement: def.departement,
      commune: def.commune,
      statut: def.statut,
    };
    etablissements.push(etab);
    const estDemo = def.nom === ETABLISSEMENT_DEMO;

    const casIci = estDemo ? (Object.entries(CAS) as [CleCas, DefinitionCas][]) : [];
    for (const [cle, c] of casIci) {
      ajouterEleve({
        etudiant: {
          nom: c.nom,
          prenom: c.prenom,
          sexe: c.sexe,
          dateNaissance: dateDeNaissance(c.niveau, false),
          etablissementId: etab.id,
          niveau: c.niveau,
        },
        niveauPrecedent: c.nouveau ? null : classePrecedente(c.niveau),
        lv2: choisir(LANGUES_VIVANTES, aleaStructure),
        base: c.avant,
        profil: "normal",
        cas: cle,
      });
    }

    // Autant de filles que de garçons, cas compris
    const restants = def.effectif - casIci.length;
    const fillesCas = casIci.filter(([, c]) => c.sexe === "F").length;
    const filles = Math.max(0, Math.round(def.effectif / 2) - fillesCas);
    const sexes = melanger(
      Array.from({ length: restants }, (_, i): Sexe => (i < filles ? "F" : "M")),
      aleaStructure
    );

    for (const sexe of sexes) {
      const groupe = tirerPondere(def.groupes, aleaStructure);
      const repartition = REPARTITION_PRENOMS[groupe];
      let nom = "";
      let prenom = "";
      do {
        nom = choisir(NOMS[groupe], aleaStructure);
        const r = aleaStructure();
        const locaux = PRENOMS_LOCAUX[groupe][sexe];
        const source =
          r < repartition.local && locaux.length > 0
            ? locaux
            : r < repartition.local + repartition.musulman
              ? PRENOMS_MUSULMANS[sexe]
              : PRENOMS_COURANTS[sexe];
        prenom = choisir(source, aleaStructure);
      } while (nomsPris.has(`${nom}|${prenom}`));
      nomsPris.add(`${nom}|${prenom}`);

      const niveau = tirerPondere(
        Object.fromEntries(def.classes.map((c) => [c, PREMIER_CYCLE.includes(c) ? 1.5 : 1])),
        aleaStructure
      );
      const redoublant = aleaStructure() < 0.08;
      ajouterEleve({
        etudiant: { nom, prenom, sexe, dateNaissance: dateDeNaissance(niveau, redoublant), etablissementId: etab.id, niveau },
        niveauPrecedent: redoublant ? niveau : classePrecedente(niveau),
        lv2: choisir(LANGUES_VIVANTES, aleaStructure),
        base: Math.min(16.5, Math.max(6, normale(aleaStructure, 10.4, 2.3))),
        profil: "normal",
      });
    }
  }

  const anneePrecedente = periodes[0].anneeScolaire;
  const inscriptions: InscriptionDemo[] = eleves.flatMap(({ etudiant, niveauPrecedent }) => [
    ...(niveauPrecedent
      ? [{ id: idStructure(), etudiantId: etudiant.id, anneeScolaire: anneePrecedente, niveau: niveauPrecedent, statut: "terminee" }]
      : []),
    { id: idStructure(), etudiantId: etudiant.id, anneeScolaire: enCours.anneeScolaire, niveau: etudiant.niveau, statut: "active" },
  ]);

  // Périodes notées de chaque élève
  const periodesDe = (e: EleveInterne) =>
    periodes.filter((p) => {
      if (e.cas === "nouveau") return clePeriode(p) === clePeriode(periodeRecente);
      return p.anneeScolaire === enCours.anneeScolaire || e.niveauPrecedent !== null;
    });

  // Hors établissement de la démo : quelques baisses et absences répétées
  const demoId = etablissements.find((e) => e.nom === ETABLISSEMENT_DEMO)!.id;
  for (const etab of etablissements) {
    if (etab.id === demoId) continue;
    const eligibles = melanger(
      eleves.filter((e) => e.etudiant.etablissementId === etab.id && periodesDe(e).length >= 2),
      aleaStructure
    );
    if (eligibles[0]) eligibles[0].profil = "baisse_moyen";
    if (eligibles[1]) eligibles[1].profil = "baisse_eleve";
    if (eligibles[2] && etablissements.indexOf(etab) % 3 === 1) eligibles[2].profil = "absences";
  }

  // Notes
  const notes: NoteDemo[] = [];
  const notesNiveauVoulu = (liste: { valeur: number; periode: string; anneeScolaire: string }[]) => {
    const c = comparerMoyennes(liste);
    return c.etat === "comparee" ? c.niveauRisque : null;
  };

  for (const e of eleves) {
    const def = e.cas ? CAS[e.cas] : undefined;
    const profilMat = profilMatieres(e.etudiant.niveau, aleaNotes);
    const profilMatPrec = e.niveauPrecedent ? profilMatieres(e.niveauPrecedent, aleaNotes) : {};
    const sesPeriodes = periodesDe(e);
    const parPeriode = new Map<string, NoteDemo[]>();

    sesPeriodes.forEach((p, i) => {
      const enCoursP = clePeriode(p) === clePeriode(periodeRecente);
      const avantDerniere = i === sesPeriodes.length - 2;
      const niveauAnnee = p.anneeScolaire === enCours.anneeScolaire ? e.etudiant.niveau : e.niveauPrecedent!;
      const profil = p.anneeScolaire === enCours.anneeScolaire ? profilMat : profilMatPrec;
      const matieres = matieresDeLEleve(niveauAnnee, e.lv2);
      const { jours } = calendrier.get(clePeriode(p))!;

      // Liste des saisies (matière, jour), réparties sur le trimestre
      const saisies: { matiere: string; jour: string }[] = [];
      for (const matiere of matieres) {
        const nb = enCoursP ? notesParMatiereEnCours : aleaNotes() < 0.3 ? 2 : 3;
        for (let k = 0; k < nb; k++) {
          const index = Math.min(jours.length - 1, Math.floor(((k + aleaNotes()) / nb) * jours.length));
          saisies.push({ matiere, jour: jours[index] });
        }
      }
      let retenues = saisies;
      if (enCoursP && def?.notesRecentes) retenues = melanger(saisies, aleaNotes).slice(0, def.notesRecentes);

      // Valeurs : moyenne exacte pour les cas (avant-dernière et dernière
      // période), sinon autour du niveau de l'élève
      const cible = def ? (enCoursP ? def.recente : avantDerniere ? def.avant : null) : null;
      let valeurs: number[];
      if (cible !== null) {
        valeurs = [];
        for (let k = 0; k + 1 < retenues.length; k += 2) {
          const d = Math.floor(aleaNotes() * Math.min(2.5, cible - 1, 19.5 - cible) * 4) / 4;
          valeurs.push(cible + d, cible - d);
        }
        if (retenues.length % 2 === 1) valeurs.push(cible);
        valeurs = melanger(valeurs, aleaNotes);
      } else {
        const moyennePeriode = (def ? def.avant : e.base) + normale(aleaNotes, 0, 0.4);
        valeurs = retenues.map((s) =>
          Math.min(19.5, Math.max(1, auQuart(moyennePeriode + (profil[s.matiere] ?? 0) + normale(aleaNotes, 0, 1.8))))
        );
      }

      parPeriode.set(
        clePeriode(p),
        retenues.map((s, k) => ({
          id: idSaisie(),
          etudiantId: e.etudiant.id,
          matiere: s.matiere,
          valeur: valeurs[k],
          periode: p.periode,
          anneeScolaire: p.anneeScolaire,
          createdAt: horodater(s.jour, aleaNotes),
        }))
      );
    });

    // Niveau d'alerte voulu sur la comparaison des deux dernières périodes
    const recentes = parPeriode.get(clePeriode(periodeRecente));
    const toutes = () => [...parPeriode.values()].flat();
    const voulu: Niveau | null = e.cas
      ? e.cas === "chute" ? "eleve" : e.cas === "baisse" || e.cas === "aggravation" ? "moyen" : null
      : e.profil === "baisse_moyen" ? "moyen" : e.profil === "baisse_eleve" ? "eleve" : null;

    if (recentes && !e.cas && sesPeriodes.length >= 2) {
      const decaler = (delta: number) => recentes.forEach((n) => (n.valeur = auQuart(n.valeur + delta)));
      if (voulu) {
        const avant = parPeriode.get(clePeriode(sesPeriodes[sesPeriodes.length - 2]))!;
        const moyenneAvant = avant.reduce((s, n) => s + n.valeur, 0) / avant.length;
        const moyenneRecente = recentes.reduce((s, n) => s + n.valeur, 0) / recentes.length;
        const baisse = voulu === "moyen" ? 0.16 + aleaNotes() * 0.025 : 0.22 + aleaNotes() * 0.15;
        const cible = voulu === "eleve" ? Math.min(9.25, moyenneAvant * (1 - baisse)) : moyenneAvant * (1 - baisse);
        decaler(cible - moyenneRecente);
      }
      for (let essai = 0; notesNiveauVoulu(toutes()) !== voulu; essai++) {
        if (essai > 400) throw new Error(`Données de démo : niveau ${voulu} impossible pour ${e.etudiant.prenom} ${e.etudiant.nom}`);
        const actuel = notesNiveauVoulu(toutes());
        // Trop de baisse : on remonte ; pas assez : on descend
        decaler(actuel === "eleve" || (actuel === "moyen" && voulu === null) ? 0.25 : -0.25);
      }
    }
    notes.push(...toutes());
  }

  // Absences
  const absences: AbsenceDemo[] = [];
  for (const e of eleves) {
    for (const p of periodesDe(e)) {
      const { jours, progression } = calendrier.get(clePeriode(p))!;
      const enCoursP = clePeriode(p) === clePeriode(periodeRecente);
      const ajouter = (jour: string, motif: AbsenceDemo["motif"]) =>
        absences.push({
          id: idSaisie(),
          etudiantId: e.etudiant.id,
          date: new Date(`${jour}T00:00:00Z`),
          motif,
          periode: p.periode,
          anneeScolaire: p.anneeScolaire,
          createdAt: horodater(jour, aleaNotes),
        });

      const injustifieesVoulues = enCoursP
        ? e.cas
          ? CAS[e.cas].absencesInjustifiees
          : e.profil === "absences"
            ? 5 + Math.floor(aleaNotes() * 7)
            : undefined
        : undefined;
      if (injustifieesVoulues) {
        const lundis = jours.filter((j) => jourDeLaSemaine(j) === 1).slice(-(injustifieesVoulues - 1));
        const autres = melanger(jours.filter((j) => !lundis.includes(j)), aleaNotes);
        const choisis = [...lundis, ...autres].slice(0, injustifieesVoulues);
        while (choisis.length < injustifieesVoulues) choisis.push(jours[choisis.length % jours.length]);
        choisis.sort().forEach((j) => ajouter(j, "injustifiee"));
        continue;
      }

      // 0 à 3 absences par trimestre, au plus 3 injustifiées : aucune alerte
      const tirage = Number(tirerPondere({ "0": 0.5, "1": 0.25, "2": 0.15, "3": 0.1 }, aleaNotes));
      const nombre = enCoursP ? Math.round(tirage * progression) : tirage;
      for (const jour of melanger(jours, aleaNotes).slice(0, nombre).sort()) {
        ajouter(jour, aleaNotes() < 0.4 ? "injustifiee" : "justifiee");
      }
    }
  }

  // Alertes, avec les règles de l'application
  const alertes: AlerteDemo[] = [];
  for (const { etudiant } of eleves) {
    const sesNotes = notes.filter((n) => n.etudiantId === etudiant.id);
    const comparaison = comparerMoyennes(sesNotes);
    if (comparaison.etat === "comparee" && comparaison.niveauRisque) {
      const { periodeAvant, periodeRecente: recente, ecartPourcent, niveauRisque } = comparaison;
      const derniere = sesNotes
        .filter((n) => n.periode === recente.periode && n.anneeScolaire === recente.anneeScolaire)
        .reduce((max, n) => (n.createdAt > max ? n.createdAt : max), new Date(0));
      alertes.push({
        id: idSaisie(),
        etudiantId: etudiant.id,
        type: "baisse_moyenne",
        niveauRisque,
        moyenneAvant: periodeAvant.moyenne,
        moyenneApres: recente.moyenne,
        ecartPourcent,
        periode: recente.periode,
        anneeScolaire: recente.anneeScolaire,
        statut: "active",
        createdAt: derniere,
        niveauModifieLe: null,
      });
    }

    const injustifiees = absences.filter((a) => a.etudiantId === etudiant.id && a.motif === "injustifiee");
    const recentes = compterAbsencesRecentes(injustifiees);
    if (recentes?.niveauRisque) {
      // Créée à la 5e absence (Moyen), aggravée à la 10e (Élevé)
      const dates = injustifiees
        .filter((a) => a.periode === recentes.periode && a.anneeScolaire === recentes.anneeScolaire)
        .map((a) => a.createdAt)
        .sort((a, b) => a.getTime() - b.getTime());
      alertes.push({
        id: idSaisie(),
        etudiantId: etudiant.id,
        type: "absences",
        niveauRisque: recentes.niveauRisque,
        moyenneAvant: 0,
        moyenneApres: recentes.count,
        ecartPourcent: 0,
        periode: recentes.periode,
        anneeScolaire: recentes.anneeScolaire,
        statut: "active",
        createdAt: dates[4],
        niveauModifieLe: recentes.niveauRisque === "eleve" ? dates[9] : null,
      });
    }
  }

  // Historique : saisies du trimestre en cours dans l'établissement de la démo
  const etudiantsDemo = new Map(eleves.filter((e) => e.etudiant.etablissementId === demoId).map((e) => [e.etudiant.id, e.etudiant]));
  const enCoursDe = (x: PeriodeRef) => clePeriode(x) === clePeriode(periodeRecente);
  const journal: JournalDemo[] = [
    ...notes
      .filter((n) => etudiantsDemo.has(n.etudiantId) && enCoursDe(n))
      .map((n): JournalDemo => {
        const e = etudiantsDemo.get(n.etudiantId)!;
        return {
          id: idSaisie(),
          action: "NOTE_CREEE",
          description: `Note ${n.valeur}/20 en ${n.matiere} pour ${e.prenom} ${e.nom}`,
          entityType: "note",
          entityId: n.id,
          createdAt: n.createdAt,
        };
      }),
    ...absences
      .filter((a) => etudiantsDemo.has(a.etudiantId) && enCoursDe(a))
      .map((a): JournalDemo => {
        const e = etudiantsDemo.get(a.etudiantId)!;
        const jour = a.date.toLocaleDateString("fr-FR", { timeZone: FUSEAU_BENIN });
        return {
          id: idSaisie(),
          action: "ABSENCE_CREEE",
          description: `Absence ${a.motif === "justifiee" ? "justifiée" : "injustifiée"} le ${jour} pour ${e.prenom} ${e.nom}`,
          entityType: "absence",
          entityId: a.id,
          createdAt: a.createdAt,
        };
      }),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const cas = Object.fromEntries(
    eleves.filter((e) => e.cas).map((e) => [e.cas!, e.etudiant])
  ) as Record<CleCas, EtudiantDemo>;

  return {
    enCours,
    periodes,
    etablissements,
    etudiants: eleves.map((e) => e.etudiant),
    inscriptions,
    notes: notes.sort((a, b) => comparerPeriodes(a, b) || a.createdAt.getTime() - b.createdAt.getTime()),
    absences,
    alertes,
    journal,
    comptes: {
      admin: { ...NOMS_COMPTES.admin, etablissementId: null, etudiantId: null },
      enseignant: { ...NOMS_COMPTES.enseignant, etablissementId: demoId, etudiantId: null },
      directeur: { ...NOMS_COMPTES.directeur, etablissementId: demoId, etudiantId: null },
      etudiant: { ...NOMS_COMPTES.etudiant, etablissementId: null, etudiantId: cas.compteEtudiant.id },
    },
    cas,
    avertissements,
  };
}
