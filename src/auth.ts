import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { headers } from "next/headers";
import { verifierRateLimit, enregistrerEchec, reinitialiserCompteur } from "@/lib/rate-limit";

const prisma = new PrismaClient();

class RateLimitError extends CredentialsSignin {
  code = "rate_limit";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const reqHeaders = await headers();
        const ip =
          reqHeaders.get("x-forwarded-for")?.split(",")[0].trim() ??
          reqHeaders.get("x-real-ip") ??
          "unknown";

        const limite = verifierRateLimit(ip);

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user) {
          if (limite.bloque) throw new RateLimitError();
          enregistrerEchec(ip);
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) {
          if (limite.bloque) throw new RateLimitError();
          enregistrerEchec(ip);
          return null;
        }

        // Mot de passe correct : on lève le blocage même si l'IP était bloquée
        reinitialiserCompteur(ip);
        return {
          id: user.id,
          email: user.email,
          name: user.nom,
          role: user.role,
          etudiantId: user.etudiantId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.etudiantId = user.etudiantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.etudiantId = token.etudiantId as string | null;
      }
      return session;
    },
  },
});
