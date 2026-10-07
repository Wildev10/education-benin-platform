import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      role: string;
      etudiantId: string | null;
    } & DefaultSession["user"];
  }
  interface User {
    role: string;
    etudiantId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    etudiantId: string | null;
  }
}