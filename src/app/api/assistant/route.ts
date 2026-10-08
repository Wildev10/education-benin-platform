import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { interpreterQuestion } from "@/lib/ai-query";
import type { RaisonIndisponible } from "@/lib/ai-query";
import { analyserSansIA } from "@/lib/assistant-fallback";
import { chargerReferentiel, exemplesQuestions } from "@/lib/assistant-referentiel";
import type { Filtres, Referentiel, Requete } from "@/lib/assistant-referentiel";
import { prisma } from "@/lib/prisma";

type Mode = "ia" | "sans_ia";

export async function POST(request: Request) {
  const access = await requireRole(["admin", "enseignant", "directeur"]);
  if (access instanceof Response) return access;

  try {
    const body = await request.json();
    if (typeof body.question !== "string" || !body.question.trim()) {
      return NextResponse.json(
        { error: "Le champ question est obligatoire" },
        { status: 400 }
      );
    }
    const question: string = body.question;

    const ref = await chargerReferentiel();
    const resultat = await interpreterQuestion(question, ref);

    let requete: Requete | null;
    let mode: Mode = "ia";
    let raison: RaisonIndisponible | undefined;

    if (resultat.statut === "ok") {
      requete = resultat.requete;
    } else {
      // Cas (a) : Gemini en erreur sur tous les modèles -> analyseur sans IA.
      raison = resultat.raison;
      mode = "sans_ia";
      requete = analyserSansIA(question, ref);
      console.error(
        `[assistant] Gemini indisponible (${raison}), mode sans IA : ${requete ? requete.type : "question non comprise"}`
      );
      if (!requete) {
        return reponseTexte(
          `L'assistant est temporairement indisponible, réessayez dans quelques minutes. Le mode simple n'a pas compris votre question non plus. ${exemples()}`,
          "indisponible",
          raison
        );
      }
    }

    // Cas (b) : Gemini a répondu, mais la question est hors périmètre.
    if (!requete || requete.type === "inconnu") {
      console.info("[assistant] question hors périmètre");
      return reponseTexte(
        `Je n'ai pas compris votre question. ${exemples()}`,
        "ia"
      );
    }

    if (requete.valeursInconnues.length > 0) {
      return reponseTexte(
        `Je ne connais pas ${requete.valeursInconnues.join(", ")}. ${valeursPossibles(ref)}`,
        mode
      );
    }

    const lignes =
      requete.type === "etudiants"
        ? await rechercherEtudiants(requete.filtres)
        : requete.type === "absences"
          ? await rechercherAbsences(requete.filtres)
          : await rechercherAlertes(requete.filtres);

    const groupes = requete.regrouperPar
      ? compter(lignes, requete.regrouperPar)
      : null;
    const etudiantsDistincts =
      requete.type === "alertes" || requete.type === "absences"
        ? new Set((lignes as Array<{ etudiantId: string }>).map((a) => a.etudiantId)).size
        : null;
    const reponse = construireReponse(requete, lignes.length, groupes, mode, etudiantsDistincts);
    console.info(
      `[assistant] ${mode} : ${requete.type}, ${lignes.length} résultat(s)`
    );

    return NextResponse.json({
      reponse,
      mode,
      nombreResultats: lignes.length,
      donnees: groupes ? [] : lignes.slice(0, 10),
    });
  } catch (error) {
    console.error("[assistant] erreur lors du traitement de la requête", error);
    return NextResponse.json(
      { error: "Impossible de traiter la question" },
      { status: 500 }
    );
  }
}

function reponseTexte(reponse: string, mode: Mode | "indisponible", raison?: RaisonIndisponible) {
  return NextResponse.json({
    reponse,
    mode,
    ...(raison ? { raison } : {}),
    nombreResultats: 0,
    donnees: [],
  });
}

function exemples() {
  return `Exemples : ${exemplesQuestions.map((e) => `« ${e} »`).join(", ")}.`;
}

function valeursPossibles(ref: Referentiel) {
  return `Établissements : ${ref.etablissements.join(", ")}. Communes : ${ref.communes.join(", ")}. Départements : ${ref.departements.join(", ")}. Niveaux : ${ref.niveaux.join(", ")}.`;
}

// Toutes les valeurs de `filtres` viennent de la liste blanche (validerRequete).
function conditionsEtudiant(filtres: Filtres) {
  return {
    ...(filtres.etablissement || filtres.departement || filtres.commune
      ? {
          etablissement: {
            ...(filtres.etablissement ? { nom: filtres.etablissement } : {}),
            ...(filtres.departement ? { departement: filtres.departement } : {}),
            ...(filtres.commune ? { commune: filtres.commune } : {}),
          },
        }
      : {}),
    ...(filtres.niveau ? { niveau: filtres.niveau } : {}),
  };
}

type Ligne = {
  niveau: string;
  etablissement: { nom: string };
};

async function rechercherEtudiants(filtres: Filtres) {
  return prisma.etudiant.findMany({
    where: {
      ...conditionsEtudiant(filtres),
      ...(filtres.periode
        ? { notes: { some: { periode: filtres.periode } } }
        : {}),
    },
    include: { etablissement: true },
  });
}

async function rechercherAbsences(filtres: Filtres) {
  return prisma.absence.findMany({
    where: {
      ...(filtres.motifAbsence ? { motif: filtres.motifAbsence } : {}),
      ...(filtres.periode ? { periode: filtres.periode } : {}),
      etudiant: conditionsEtudiant(filtres),
    },
    include: { etudiant: { include: { etablissement: true } } },
  });
}

async function rechercherAlertes(filtres: Filtres) {
  return prisma.alerte.findMany({
    where: {
      ...(filtres.niveauRisque ? { niveauRisque: filtres.niveauRisque } : {}),
      ...(filtres.statutAlerte ? { statut: filtres.statutAlerte } : {}),
      ...(filtres.periode ? { periode: filtres.periode } : {}),
      etudiant: conditionsEtudiant(filtres),
    },
    include: { etudiant: { include: { etablissement: true } } },
  });
}

function compter(lignes: unknown[], par: "etablissement" | "niveau") {
  const groupes = new Map<string, number>();
  for (const brut of lignes) {
    const item = brut as Ligne & { etudiant?: Ligne };
    const source = item.etudiant ?? item;
    const cle = par === "niveau" ? source.niveau : source.etablissement.nom;
    groupes.set(cle, (groupes.get(cle) ?? 0) + 1);
  }
  return Array.from(groupes.entries()).sort((a, b) => b[1] - a[1]);
}

function decrireFiltres(filtres: Filtres) {
  const parties = [
    filtres.etablissement && `établissement ${filtres.etablissement}`,
    filtres.commune && `commune ${filtres.commune}`,
    filtres.departement && `département ${filtres.departement}`,
    filtres.niveau && `niveau ${filtres.niveau}`,
    filtres.periode && `période ${filtres.periode}`,
    filtres.motifAbsence && `motif ${filtres.motifAbsence}`,
  ].filter(Boolean);
  return parties.length > 0 ? ` (${parties.join(", ")})` : "";
}

// La phrase est construite par le code : aucun appel IA supplémentaire.
function construireReponse(
  requete: Requete,
  total: number,
  groupes: Array<[string, number]> | null,
  mode: Mode,
  etudiantsDistincts: number | null
) {
  const { type, filtres } = requete;
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
  const nom = type === "etudiants" ? "étudiant" : type === "absences" ? "absence" : "alerte";

  let qualificatif = "";
  if (type === "absences" && filtres.motifAbsence) {
    qualificatif = ` ${filtres.motifAbsence === "injustifiee" ? "injustifiée" : "justifiée"}${total > 1 ? "s" : ""}`;
  }
  if (type === "alertes") {
    const statut = filtres.statutAlerte
      ? filtres.statutAlerte === "active"
        ? total > 1 ? "actives" : "active"
        : total > 1 ? "traitées" : "traitée"
      : "";
    const risque = filtres.niveauRisque
      ? `de risque ${filtres.niveauRisque === "eleve" ? "élevé" : "moyen"}`
      : "";
    qualificatif = [statut, risque].filter(Boolean).join(" ");
    if (qualificatif) qualificatif = ` ${qualificatif}`;
  }

  // "6 alertes concernant 4 étudiants" / "6 absences concernant 4 étudiants"
  const concernant =
    etudiantsDistincts !== null && total > 0
      ? ` concernant ${pluriel(etudiantsDistincts, "étudiant")}`
      : "";

  let phrase: string;
  if (groupes && requete.regrouperPar) {
    const detail = groupes.map(([cle, n]) => `${cle} : ${n}`).join(" ; ");
    phrase = `Il y a ${pluriel(total, nom)}${qualificatif}${concernant}${decrireFiltres(filtres)}, par ${requete.regrouperPar === "etablissement" ? "établissement" : "niveau"} — ${detail || "aucun résultat"}.`;
  } else if (total === 0) {
    phrase = `Aucun${type === "alertes" ? "e" : ""} ${nom}${qualificatif} ne correspond${decrireFiltres(filtres)}.`;
  } else {
    phrase = `Il y a ${pluriel(total, nom)}${qualificatif}${concernant}${decrireFiltres(filtres)}${total > 10 ? " (les 10 premiers sont affichés)" : ""}.`;
  }

  return mode === "sans_ia"
    ? `${phrase} (Calculé sans IA : l'assistant IA est temporairement indisponible.)`
    : phrase;
}
