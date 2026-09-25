import { GoogleGenAI, Type } from "@google/genai";

export type AssistantQueryType = "etudiants" | "alertes" | "inconnu";

export type AssistantFilters = {
  etablissementId?: string;
  departement?: string;
  niveau?: string;
  niveauRisque?: "moyen" | "eleve";
  statutAlerte?: "active" | "traitee";
  periode?: string;
};

export type AssistantQuery = {
  type: AssistantQueryType;
  filtres: AssistantFilters;
};

const filtreSchema = {
  type: Type.OBJECT,
  properties: {
    etablissementId: { type: Type.STRING },
    departement: { type: Type.STRING },
    niveau: { type: Type.STRING },
    niveauRisque: { type: Type.STRING, enum: ["moyen", "eleve"] },
    statutAlerte: { type: Type.STRING, enum: ["active", "traitee"] },
    periode: { type: Type.STRING },
  },
};

const reponseSchema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: ["etudiants", "alertes", "inconnu"] },
    filtres: filtreSchema,
  },
  required: ["type", "filtres"],
};

const systemInstruction = `Tu traduis une question en français en filtre structuré pour une application scolaire.
Les seules données interrogeables sont les étudiants et les alertes.
Pour les étudiants, les champs filtrables sont etablissementId, departement (via l'établissement lié), niveau et periode (via les notes liées si la question demande une période).
Pour les alertes, les champs filtrables sont etablissementId, departement (via l'étudiant puis son établissement), niveau, niveauRisque (seulement "moyen" ou "eleve"), statutAlerte (seulement "active" ou "traitee") et periode.
Utilise uniquement les noms de champs indiqués, sans SQL ni code.
Si la question ne permet pas d'identifier un filtre exploitable ou ne concerne pas ces données, retourne type "inconnu" et filtres {}.
Retourne exclusivement l'objet JSON demandé.`;

const unknownQuery: AssistantQuery = { type: "inconnu", filtres: {} };
const primaryModel = "gemini-flash-latest";
const fallbackModel = "gemini-flash-lite-latest";

export async function interpreterQuestion(
  question: string
): Promise<AssistantQuery> {
  if (!question.trim() || !process.env.GEMINI_API_KEY) return unknownQuery;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let latestError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (attempt > 1) {
        await attendre(attempt === 2 ? 1000 : 2000);
        console.log(
          `[assistant] tentative ${attempt}/3 sur ${primaryModel} après 503`
        );
      } else {
        console.log(`[assistant] tentative 1/3 sur ${primaryModel}`);
      }

      try {
        return parserReponse(
          await genererAvecModele(ai, primaryModel, question)
        );
      } catch (error) {
        latestError = error;
        if (!est503(error)) return unknownQuery;
      }
    }

    console.log(`[assistant] fallback vers ${fallbackModel}`);
    try {
      return parserReponse(
        await genererAvecModele(ai, fallbackModel, question)
      );
    } catch (error) {
      latestError = error;
    }

    if (latestError) {
      console.log("[assistant] fallback Gemini indisponible, réponse inconnue");
    }
    return unknownQuery;
  } catch (error) {
    console.log("[assistant] erreur Gemini non retentée, réponse inconnue");
    return unknownQuery;
  }
}

async function genererAvecModele(
  ai: GoogleGenAI,
  model: string,
  question: string
) {
  console.log(`[assistant] appel ${model}`);
  return ai.models.generateContent({
    model,
    contents: question,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: reponseSchema,
      temperature: 0,
    },
  });
}

function parserReponse(response: { text?: string | null }): AssistantQuery {
  return normaliserRequete(JSON.parse(response.text ?? ""));
}

function est503(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; error?: { code?: unknown } };
  return candidate.status === 503 || candidate.error?.code === 503;
}

function attendre(delaiMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delaiMs));
}

function normaliserRequete(value: unknown): AssistantQuery {
  if (!value || typeof value !== "object") return unknownQuery;

  const candidate = value as {
    type?: unknown;
    filtres?: unknown;
  };
  if (
    candidate.type !== "etudiants" &&
    candidate.type !== "alertes" &&
    candidate.type !== "inconnu"
  ) {
    return unknownQuery;
  }

  if (!candidate.filtres || typeof candidate.filtres !== "object") {
    return { type: candidate.type, filtres: {} };
  }

  const raw = candidate.filtres as Record<string, unknown>;
  const filtres: AssistantFilters = {};
  for (const field of [
    "etablissementId",
    "departement",
    "niveau",
    "periode",
  ] as const) {
    if (typeof raw[field] === "string" && raw[field].trim()) {
      filtres[field] = raw[field].trim();
    }
  }
  if (raw.niveauRisque === "moyen" || raw.niveauRisque === "eleve") {
    filtres.niveauRisque = raw.niveauRisque;
  }
  if (raw.statutAlerte === "active" || raw.statutAlerte === "traitee") {
    filtres.statutAlerte = raw.statutAlerte;
  }

  return {
    type: candidate.type,
    filtres: candidate.type === "inconnu" ? {} : filtres,
  };
}
