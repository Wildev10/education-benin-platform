import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { accueilDuRole } from "@/lib/accueil";
import type { Langue } from "@/lib/i18n/langue";
import HomePage from "./_HomePage";

/**
 * Page d'accueil publique, en français sous « / » et en anglais sous « /en ».
 * Une personne connectée est envoyée vers son espace, toujours en français.
 */
export async function AccueilPublic({ langue }: { langue: Langue }) {
  const session = await auth();
  if (session?.user) redirect(accueilDuRole(session.user.role) ?? "/login");
  return <HomePage langue={langue} />;
}
