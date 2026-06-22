import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/analyst"];
const ADMIN_PREFIXES = ["/admin"];

const ANALYST_ONLY_DASHBOARD_PREFIXES = [
  "/dashboard/intelligence",
  "/dashboard/explainability",
  "/dashboard/scenarios",
  "/dashboard/accuracy",
  "/dashboard/analytics",
  "/dashboard/research",
];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAnalystOnlyDashboardPath(pathname: string): boolean {
  return ANALYST_ONLY_DASHBOARD_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.get("ic_session")?.value === "1";
  const role = request.cookies.get("ic_role")?.value;

  const isProtected = matchesPrefix(pathname, PROTECTED_PREFIXES);
  const isAdmin = matchesPrefix(pathname, ADMIN_PREFIXES);

  if ((isProtected || isAdmin) && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("redirect", pathname);
    return NextResponse.redirect(login);
  }

  if (isAdmin && role !== "admin") {
    return NextResponse.redirect(new URL("/access-denied", request.url));
  }

  if (
    pathname.startsWith("/analyst") &&
    role !== "analyst" &&
    role !== "admin"
  ) {
    return NextResponse.redirect(new URL("/access-denied", request.url));
  }

  if (role === "user" && isAnalystOnlyDashboardPath(pathname)) {
    return NextResponse.redirect(new URL("/access-denied", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/analyst/:path*", "/admin/:path*"],
};