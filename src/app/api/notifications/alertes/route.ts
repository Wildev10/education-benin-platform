import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { getNotifications, marquerNotificationsVues } from "@/lib/notifications-server";

const nonAuthentifie = () => NextResponse.json({ error: "Non authentifie" }, { status: 401 });

/** Admin : toutes les alertes. Directeur et enseignant : celles de leur établissement. */
const ROLES_NOTIFICATIONS = ["admin", "directeur", "enseignant"];

export async function GET() {
  const access = await requireRole(ROLES_NOTIFICATIONS);
  if (access instanceof Response) return access;

  const { id, role, etablissementId } = access.user;
  if (!id) return nonAuthentifie();

  try {
    return NextResponse.json(await getNotifications({ id, role, etablissementId }));
  } catch (error) {
    console.error("Erreur GET notifications/alertes", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les notifications." },
      { status: 500 }
    );
  }
}

/** Ouverture de la cloche : corps { jusquA } (date ISO du dernier événement affiché). */
export async function POST(request: Request) {
  const access = await requireRole(ROLES_NOTIFICATIONS);
  if (access instanceof Response) return access;

  if (!access.user.id) return nonAuthentifie();

  const corps = await request.json().catch(() => null);
  const jusquA = typeof corps?.jusquA === "string" ? new Date(corps.jusquA) : null;
  if (!jusquA || Number.isNaN(jusquA.getTime())) {
    return NextResponse.json({ error: "Date jusquA invalide." }, { status: 400 });
  }

  try {
    return NextResponse.json({ vuesLe: await marquerNotificationsVues(access.user.id, jusquA) });
  } catch (error) {
    console.error("Erreur POST notifications/alertes", error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer la consultation." },
      { status: 500 }
    );
  }
}
