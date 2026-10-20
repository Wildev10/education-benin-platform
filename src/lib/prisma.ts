import net from "node:net";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Pour un hôte à plusieurs adresses (le pooler Neon en a plusieurs, IPv4 et
// IPv6), Node les essaie une à une et abandonne chacune après 250 ms par
// défaut. Sur un réseau lent (aller-retour > 250 ms), toutes les tentatives
// IPv4 sont coupées avant d'aboutir et la connexion échoue en ETIMEDOUT.
// 2 s par adresse : sans effet sur un réseau rapide (Vercel → Neon).
export const DELAI_TENTATIVE_PAR_ADRESSE_MS = 2000;
if (net.getDefaultAutoSelectFamilyAttemptTimeout() < DELAI_TENTATIVE_PAR_ADRESSE_MS) {
  net.setDefaultAutoSelectFamilyAttemptTimeout(DELAI_TENTATIVE_PAR_ADRESSE_MS);
}

/** Opérations de lecture : les seules rejouées après une erreur de connexion. */
const LECTURES = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

const CODES_CONNEXION = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EPIPE", "EAI_AGAIN", "P1001", "P1017"]);
const MESSAGES_CONNEXION = [
  "timeout exceeded when trying to connect",
  "Connection terminated due to connection timeout",
  "Connection terminated unexpectedly",
];

/**
 * Erreur survenue en ouvrant ou en perdant la connexion à la base (réveil de
 * Neon, réseau, connexion inactive coupée), et non une erreur de la requête.
 */
export function estErreurDeConnexion(erreur: unknown): boolean {
  if (!(erreur instanceof Error)) return false;
  const code = (erreur as { code?: unknown }).code;
  const cause = (erreur as { cause?: unknown }).cause;
  return (
    (typeof code === "string" && CODES_CONNEXION.has(code)) ||
    MESSAGES_CONNEXION.some((m) => erreur.message.includes(m)) ||
    (cause !== erreur && estErreurDeConnexion(cause))
  );
}

/**
 * Exécute une opération Prisma ; une lecture qui échoue sur une erreur de
 * connexion est rejouée une fois. Une écriture ne l'est jamais : si la
 * connexion a coupé après l'envoi, la rejouer pourrait l'appliquer deux fois.
 */
export async function avecNouvelleTentative<T>(operation: string, executer: () => Promise<T>): Promise<T> {
  try {
    return await executer();
  } catch (erreur) {
    if (!LECTURES.has(operation) || !estErreurDeConnexion(erreur)) throw erreur;
    const code = (erreur as { code?: unknown }).code;
    const detail = typeof code === "string" ? code : (erreur as Error).message.trim().split("\n")[0];
    console.warn(`[prisma] ${operation} : nouvelle tentative après une erreur de connexion (${detail})`);
    return executer();
  }
}

/**
 * Client Prisma de l'application. Prisma 7 passe par un driver adapter :
 * ici node-postgres (pg), connecté au pooler Neon de DATABASE_URL.
 */
export function creerClientPrisma() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // 15 s, comme le recommande Neon : un réveil de la base après une mise en
    // veille, ou un réseau lent, peut dépasser les 5 s habituels
    connectionTimeoutMillis: 15000,
  });
  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        $allOperations({ operation, args, query }) {
          return avecNouvelleTentative(operation, () => query(args));
        },
      },
    },
  });
}

type ClientPrisma = ReturnType<typeof creerClientPrisma>;

const globalForPrisma = globalThis as unknown as {
  prisma: ClientPrisma | undefined;
};

export const prisma = globalForPrisma.prisma ?? creerClientPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
