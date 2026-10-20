import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";
import type { NextFetchEvent, NextRequest } from "next/server";
import {
  CHEMINS,
  COOKIE_LANGUE,
  DUREE_COOKIE_LANGUE_S,
  EN_TETE_LANGUE,
  PARAMETRE_LANGUE,
  estLangue,
  pagePublique,
  type Langue,
} from "@/lib/i18n/langue";

type AuthMiddleware = (
  request: NextAuthRequest,
  event: NextFetchEvent
) => ReturnType<import("next/server").NextMiddleware>;

/**
 * En-têtes de la requête transmise à l'application, avec la langue d'affichage
 * (lue par la mise en page racine pour l'attribut lang). Toujours écrasée :
 * un client ne peut pas imposer l'anglais à une page de l'application.
 */
function entetesAvecLangue(request: NextRequest, langue: Langue) {
  const entetes = new Headers(request.headers);
  entetes.set(EN_TETE_LANGUE, langue);
  return { request: { headers: entetes } };
}

const continuer = (request: NextRequest, langue: Langue = "fr") => NextResponse.next(entetesAvecLangue(request, langue));

const authMiddleware: AuthMiddleware = (request) => {
  const { pathname } = request.nextUrl;
  const session = request.auth;

  // Pages publiques bilingues : accueil (/ et /en) et connexion (/login et /en/login)
  const publique = pagePublique(pathname);
  if (publique) {
    // Sélecteur de langue : le choix est mémorisé, puis on redirige vers l'adresse propre
    const demandee = request.nextUrl.searchParams.get(PARAMETRE_LANGUE);
    if (estLangue(demandee)) {
      const reponse = NextResponse.redirect(new URL(CHEMINS[publique.page][demandee], request.url));
      reponse.cookies.set(COOKIE_LANGUE, demandee, {
        path: "/",
        maxAge: DUREE_COOKIE_LANGUE_S,
        sameSite: "lax",
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
      });
      return reponse;
    }
    // Choix mémorisé : un visiteur qui a choisi l'anglais arrive sur la version anglaise.
    // Une adresse anglaise explicite (/en…) est toujours respectée. Une personne
    // connectée garde le comportement actuel (son espace, en français).
    const memorisee = request.cookies.get(COOKIE_LANGUE)?.value;
    if (!session?.user && publique.langue === "fr" && estLangue(memorisee) && memorisee !== "fr") {
      return NextResponse.redirect(new URL(CHEMINS[publique.page][memorisee], request.url));
    }
    return continuer(request, publique.langue);
  }

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = session.user.role;

  // Un étudiant n'a accès qu'à sa propre fiche, dans /etudiant : toute URL de fiche
  // élève lui affiche la page introuvable, sans révéler si l'élève existe.
  if (role === "etudiant" && /^\/(enseignant|admin)\/etudiants\/[^/]+/.test(pathname)) {
    return NextResponse.rewrite(new URL("/_introuvable", request.url), entetesAvecLangue(request, "fr"));
  }
  const requiredRoles = pathname.startsWith("/admin")
    ? ["admin"]
    : pathname.startsWith("/directeur")
      ? ["directeur"]
      : pathname.startsWith("/enseignant")
        ? ["enseignant", "admin", "directeur"]
        : pathname.startsWith("/etudiant")
          ? ["etudiant", "admin"]
          : null;

  if (requiredRoles && !requiredRoles.includes(role)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return continuer(request);
};

const authProxy = auth(authMiddleware);

export function proxy(request: NextRequest, event: NextFetchEvent) {
  return authProxy(request, event);
}

export default proxy;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};