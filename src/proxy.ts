import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const authProxy = auth((request) => {
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
});

export function proxy(request: NextRequest) {
  return authProxy(request);
}

export default proxy;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};