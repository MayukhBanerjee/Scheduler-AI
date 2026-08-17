import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyToken } from "./lib/auth-edge";

const PROTECTED_ROUTES = ["/dashboard/user", "/dashboard/client", "/dashboard"];
const AUTH_ROUTES = ["/login", "/signup"];

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const token = req.cookies.get("auth_token")?.value;
  const session = token ? await verifyToken(token) : null;

  // Redirect authenticated users away from auth pages
  if (session && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    const dest =
      session.role === "provider"
        ? "/dashboard/client"
        : "/dashboard/user";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  // Guard protected routes
  if (PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (
      pathname.startsWith("/dashboard/client") &&
      session.role !== "provider"
    ) {
      return NextResponse.redirect(new URL("/dashboard/user", req.url));
    }

    if (
      pathname.startsWith("/dashboard/user") &&
      session.role !== "user"
    ) {
      return NextResponse.redirect(new URL("/dashboard/client", req.url));
    }
  }

  return NextResponse.next();
}

// Keep matcher narrow — broad regex matchers are a common cause of
// "Cannot find the middleware module" after Next.js hot reloads.
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
