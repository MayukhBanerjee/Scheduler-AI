import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyToken } from "./lib/auth-edge";

const PROTECTED_ROUTES = ["/dashboard/user", "/dashboard/client", "/dashboard"];
const AUTH_ROUTES = ["/login", "/signup"];

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const token = req.cookies.get("auth_token")?.value;
  const session = token ? await verifyToken(token) : null;

  // Handle auth pages (/login, /signup)
  if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    if (session) {
      const requestedRole =
        req.nextUrl.searchParams.get("type") ||
        req.nextUrl.searchParams.get("role");

      // If user explicitly asks for a different role (e.g. user -> provider), allow them to switch!
      if (requestedRole && requestedRole !== session.role) {
        return NextResponse.next();
      }

      // Otherwise redirect them to their active role's dashboard
      const dest =
        session.role === "provider" ? "/dashboard/client" : "/dashboard/user";
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  // Guard protected routes (/dashboard/*)
  if (PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!session) {
      const targetRole = pathname.startsWith("/dashboard/client")
        ? "provider"
        : "user";
      return NextResponse.redirect(new URL(`/login?type=${targetRole}`, req.url));
    }

    // Role mismatch: provider accessing /dashboard/user or user accessing /dashboard/client
    if (
      pathname.startsWith("/dashboard/client") &&
      session.role !== "provider"
    ) {
      return NextResponse.redirect(
        new URL("/login?type=provider&switch=true", req.url)
      );
    }

    if (
      pathname.startsWith("/dashboard/user") &&
      session.role !== "user"
    ) {
      return NextResponse.redirect(
        new URL("/login?type=user&switch=true", req.url)
      );
    }

    // Generic /dashboard redirect
    if (pathname === "/dashboard") {
      const dest =
        session.role === "provider" ? "/dashboard/client" : "/dashboard/user";
      return NextResponse.redirect(new URL(dest, req.url));
    }
  }

  return NextResponse.next();
}

// Keep matcher narrow — broad regex matchers are a common cause of
// "Cannot find the middleware module" after Next.js hot reloads.
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
