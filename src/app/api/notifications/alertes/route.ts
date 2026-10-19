import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { getAlertesRecentes } from "@/lib/notifications-server";

export async function GET() {
  const access = await requireRole(["admin", "directeur"]);
  if (access instanceof Response) return access;

  const { role, etablissementId } = access.user;

  // Un directeur sans établissement rattaché ne doit rien voir (et surtout pas tout).
  if (role === "directeur" && !etablissementId) {
    return NextResponse.json([]);
  }

  try {
    const alertes = await getAlertesRecentes(role === "directeur" ? etablissementId : null);
    return NextResponse.json(alertes);
  } catch (error) {
    console.error("Erreur GET notifications/alertes", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les notifications." },
      { status: 500 }
    );
  }
}
