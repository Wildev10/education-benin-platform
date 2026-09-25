import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { interpreterQuestion } from "@/lib/ai-query";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const access = await requireRole(["admin", "enseignant"]);
  if (access instanceof Response) return access;

  try {
    const body = await request.json();
    if (typeof body.question !== "string" || !body.question.trim()) {
      return NextResponse.json(
        { error: "Le champ question est obligatoire" },
        { status: 400 }
      );
    }

    const requete = await interpreterQuestion(body.question);
    if (requete.type === "inconnu") {
      return NextResponse.json({
        reponse: "Je n'ai pas compris votre question, essayez de reformuler.",
        nombreResultats: 0,
        donnees: [],
      });
    }

    const donnees =
      requete.type === "etudiants"
        ? await rechercherEtudiants(requete.filtres)
        : await rechercherAlertes(requete.filtres);
    const resume = creerResume(requete.type, donnees);
    const reponse = await formulerReponse(body.question, requete.type, donnees.length, resume);

    return NextResponse.json({
      reponse,
      nombreResultats: donnees.length,
      donnees: donnees.slice(0, 10),
    });
  } catch (error) {
    console.error("Erreur lors du traitement de la requête assistant", error);
    return NextResponse.json(
      { error: "Impossible de traiter la question" },
      { status: 500 }
    );
  }
}

async function rechercherEtudiants(filtres: {
  etablissementId?: string;
  departement?: string;
  niveau?: string;
  periode?: string;
}) {
  return prisma.etudiant.findMany({
    where: {
      ...(filtres.etablissementId || filtres.departement
        ? {
            etablissement: {
              ...(filtres.etablissementId
                ? { id: filtres.etablissementId }
                : {}),
              ...(filtres.departement
                ? { departement: { contains: filtres.departement, mode: "insensitive" } }
                : {}),
            },
          }
        : {}),
      ...(filtres.niveau
        ? { niveau: { contains: filtres.niveau, mode: "insensitive" } }
        : {}),
      ...(filtres.periode
        ? { notes: { some: { periode: { contains: filtres.periode, mode: "insensitive" } } } }
        : {}),
    },
    include: { etablissement: true },
  });
}

async function rechercherAlertes(filtres: {
  etablissementId?: string;
  departement?: string;
  niveau?: string;
  niveauRisque?: "moyen" | "eleve";
  statutAlerte?: "active" | "traitee";
  periode?: string;
}) {
  return prisma.alerte.findMany({
    where: {
      ...(filtres.niveauRisque ? { niveauRisque: filtres.niveauRisque } : {}),
      ...(filtres.statutAlerte ? { statut: filtres.statutAlerte } : {}),
      ...(filtres.periode
        ? { periode: { contains: filtres.periode, mode: "insensitive" } }
        : {}),
      etudiant: {
        ...(filtres.niveau
          ? { niveau: { contains: filtres.niveau, mode: "insensitive" } }
          : {}),
        ...(filtres.etablissementId || filtres.departement
          ? {
              etablissement: {
                ...(filtres.etablissementId
                  ? { id: filtres.etablissementId }
                  : {}),
                ...(filtres.departement
                  ? { departement: { contains: filtres.departement, mode: "insensitive" } }
                  : {}),
              },
            }
          : {}),
      },
    },
    include: {
      etudiant: { include: { etablissement: true } },
    },
  });
}

function creerResume(type: "etudiants" | "alertes", donnees: unknown[]) {
  if (type === "etudiants") {
    const parNiveau = new Map<string, number>();
    for (const item of donnees as Array<{ niveau: string }>) {
      parNiveau.set(item.niveau, (parNiveau.get(item.niveau) ?? 0) + 1);
    }
    return {
      type,
      parNiveau: Object.fromEntries(parNiveau),
    };
  }

  const parRisque = new Map<string, number>();
  const parStatut = new Map<string, number>();
  for (const item of donnees as Array<{ niveauRisque: string; statut: string }>) {
    parRisque.set(item.niveauRisque, (parRisque.get(item.niveauRisque) ?? 0) + 1);
    parStatut.set(item.statut, (parStatut.get(item.statut) ?? 0) + 1);
  }
  return {
    type,
    parRisque: Object.fromEntries(parRisque),
    parStatut: Object.fromEntries(parStatut),
  };
}

async function formulerReponse(
  question: string,
  type: "etudiants" | "alertes",
  nombreResultats: number,
  resume: object
) {
  if (!process.env.GEMINI_API_KEY) {
    return `J'ai trouvé ${nombreResultats} résultat${nombreResultats > 1 ? "s" : ""}.`;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: JSON.stringify({ question, type, nombreResultats, resume }),
      config: {
        systemInstruction:
          "Réponds en une phrase courte et naturelle en français. Base-toi uniquement sur le nombre et le résumé fournis. N'invente aucune donnée et ne fournis ni SQL ni code.",
        temperature: 0.2,
      },
    });

    return response.text?.trim() || reponseLocale(nombreResultats);
  } catch {
    console.log("[assistant] formulation Gemini indisponible, réponse locale");
    return reponseLocale(nombreResultats);
  }
}

function reponseLocale(nombreResultats: number) {
  return `J'ai trouvé ${nombreResultats} résultat${nombreResultats > 1 ? "s" : ""}.`;
}
