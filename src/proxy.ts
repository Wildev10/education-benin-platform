import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";
import type { NextFetchEvent, NextRequest } from "next/server";

type AuthMiddleware = (
  request: NextAuthRequest,
  event: NextFetchEvent
) => ReturnType<import("next/server").NextMiddleware>;

const authMiddleware: AuthMiddleware = (request) => {
  const { pathname } = request.nextUrl;
  const session = request.auth;

  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = session.user.role;
  const requiredRoles = pathname.startsWith("/admin")
    ? ["admin"]
    : pathname.startsWith("/enseignant")
      ? ["enseignant", "admin"]
      : pathname.startsWith("/etudiant")
        ? ["etudiant", "admin"]
        : null;

  if (requiredRoles && !requiredRoles.includes(role)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
};

const authProxy = auth(authMiddleware);

export function proxy(request: NextRequest, event: NextFetchEvent) {
  return authProxy(request, event);
}

export default proxy;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};