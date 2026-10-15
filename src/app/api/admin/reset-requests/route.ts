import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { getDemandesEnAttente } from "@/lib/reset-requests";

export async function GET() {
  const access = await requireRole(["admin"]);
  if (access instanceof Response) return access;

  try {
    return NextResponse.json(await getDemandesEnAttente());
  } catch (error) {
    console.error("Erreur GET reset-requests", error);
    return NextResponse.json({ error: "Impossible de récupérer les demandes." }, { status: 500 });
  }
}
