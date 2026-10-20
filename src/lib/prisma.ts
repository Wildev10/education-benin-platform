import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Client Prisma unique de l'application. Prisma 7 passe par un driver
 * adapter : ici node-postgres (pg), connecté au pooler Neon de DATABASE_URL.
 */
export function creerClientPrisma() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // pg n'a pas de délai de connexion par défaut ; 5 s comme Prisma 6
    connectionTimeoutMillis: 5000,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? creerClientPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
