import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { getHistorique } from "@/lib/historique";

export async function GET(request: Request) {
  const access = await requireRole(["admin"]);
  if (access instanceof Response) return access;

  try {
    const sp = new URL(request.url).searchParams;
    const logs = await getHistorique({ action: sp.get("action"), userId: sp.get("userId") });
    return NextResponse.json(logs);
  } catch (error) {
    console.error("Erreur GET historique", error);
    return NextResponse.json({ error: "Impossible de récupérer l'historique." }, { status: 500 });
  }
}
