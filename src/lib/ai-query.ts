import { GoogleGenAI, Type } from "@google/genai";
import { validerRequete } from "@/lib/assistant-referentiel";
import type { Referentiel, Requete } from "@/lib/assistant-referentiel";

// Erreur d'appel Gemini (a) ou réponse exploitable (b) : jamais mélangés.
export type RaisonIndisponible =
  | "quota"
  | "surcharge"
  | "cle"
  | "timeout"
  | "autre";

export type ResultatIA =
  | { statut: "ok"; requete: Requete }
  | { statut: "indisponible"; raison: RaisonIndisponible };

const modeles = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const retries503 = 2;
// Gemini refuse toute échéance inférieure à 10 s.
const timeoutMs = 15000;

const filtreSchema = {
  type: Type.OBJECT,
  properties: {
    etablissement: { type: Type.STRING },
    departement: { type: Type.STRING },
    commune: { type: Type.STRING },
    niveau: { type: Type.STRING },
    periode: { type: Type.STRING },
    niveauRisque: { type: Type.STRING, enum: ["moyen", "eleve"] },
    statutAlerte: { type: Type.STRING, enum: ["active", "traitee"] },
    motifAbsence: { type: Type.STRING, enum: ["injustifiee", "justifiee"] },
  },
};

const reponseSchema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: ["etudiants", "alertes", "absences", "inconnu"] },
    filtres: filtreSchema,
    regrouperPar: { type: Type.STRING, enum: ["etablissement", "niveau"] },
  },
  required: ["type", "filtres"],
};

function creerConsigne(ref: Referentiel) {
  return `Tu traduis une question en français en filtre JSON pour une application scolaire. Tu ne produis jamais de SQL ni de code.
Données interrogeables : les étudiants (type "etudiants"), les alertes de baisse de résultats (type "alertes"), et les absences (type "absences"). Une question sur les étudiants "à risque" concerne les alertes.
Filtres possibles (n'utilise que des valeurs EXACTES de ces listes, sinon omets le filtre) :
- etablissement : ${ref.etablissements.join(" | ")}
- departement : ${ref.departements.join(" | ")}
- commune : ${ref.communes.join(" | ")}
- niveau : ${ref.niveaux.join(" | ")}
- periode : ${ref.periodes.join(" | ")}
- niveauRisque (alertes seulement) : "moyen" ou "eleve"
- statutAlerte (alertes seulement) : "active" ou "traitee"
- motifAbsence (absences seulement) : "injustifiee" ou "justifiee"
regrouperPar : "etablissement" ou "niveau" quand la question demande une répartition ou un nombre par établissement ou par niveau.
Si la question ne concerne pas ces données, retourne type "inconnu" et filtres {}.
Retourne exclusivement l'objet JSON demandé.`;
}

export async function interpreterQuestion(
  question: string,
  ref: Referentiel
): Promise<ResultatIA> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[assistant] GEMINI_API_KEY absente de l'environnement");
    return { statut: "indisponible", raison: "cle" };
  }

  const ai = new GoogleGenAI({ apiKey });
  const consigne = creerConsigne(ref);
  let derniereRaison: RaisonIndisponible = "autre";

  for (const modele of modeles) {
    for (let essai = 0; essai <= retries503; essai += 1) {
      if (essai > 0) await attendre(essai * 1000);

      try {
        const response = await ai.models.generateContent({
          model: modele,
          contents: question,
          config: {
            systemInstruction: consigne,
            responseMimeType: "application/json",
            responseSchema: reponseSchema,
            temperature: 0,
            httpOptions: { timeout: timeoutMs },
          },
        });
        return {
          statut: "ok",
          requete: validerRequete(JSON.parse(response.text ?? ""), ref),
        };
      } catch (error) {
        derniereRaison = classerErreur(error);
        console.error(
          `[assistant] ${modele} : ${derniereRaison}`,
          derniereRaison === "autre" ? resumeErreur(error) : ""
        );

        // Clé invalide : inutile d'essayer un autre modèle.
        if (derniereRaison === "cle") return { statut: "indisponible", raison: "cle" };
        // 503 : on réessaie le même modèle. Tout le reste (429, timeout...) : modèle suivant.
        if (derniereRaison !== "surcharge") break;
      }
    }
  }

  return { statut: "indisponible", raison: derniereRaison };
}

function classerErreur(error: unknown): RaisonIndisponible {
  const e = error as {
    name?: string;
    message?: string;
    status?: number;
    error?: { code?: number };
  };
  const code = e?.status ?? e?.error?.code;
  if (code === 429) return "quota";
  if (code === 503) return "surcharge";
  if (code === 504) return "timeout";
  if (code === 401 || code === 403 || (code === 400 && /api key/i.test(e?.message ?? ""))) {
    return "cle";
  }
  if (e?.name === "AbortError" || /timeout|timed out|abort/i.test(e?.message ?? "")) {
    return "timeout";
  }
  return "autre";
}

function resumeErreur(error: unknown) {
  const e = error as { status?: number; message?: string };
  return `${e?.status ?? ""} ${(e?.message ?? String(error)).slice(0, 150)}`.trim();
}

function attendre(delaiMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delaiMs));
}
