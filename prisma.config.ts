import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 ne charge plus .env lui-même : dotenv/config ci-dessus s'en charge.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // process.env plutôt que env() : env() fait échouer toute commande, même
    // `prisma generate` (lancé à l'installation), quand la variable manque
    url: process.env.DATABASE_URL ?? "",
  },
});
