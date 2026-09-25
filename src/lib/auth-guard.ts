import type { Session } from "next-auth";
import { auth } from "@/auth";

export async function requireRole(
  rolesAutorises: string[]
): Promise<Session | Response> {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Non authentifie" }, { status: 401 });
  }

  if (!rolesAutorises.includes(session.user.role)) {
    return Response.json({ error: "Acces interdit" }, { status: 403 });
  }

  return session;
}
