import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const roleClaim = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isAdminOrEmployee(token: string) {
  const payload = decodeJwtPayload(token);
  const expiresAt = typeof payload?.exp === "number" ? payload.exp * 1000 : 0;
  const role = payload?.[roleClaim] ?? payload?.role;
  return expiresAt > Date.now() && (role === "Administrator" || role === "Employee");
}

function isAdministrator(token: string) {
  const payload = decodeJwtPayload(token);
  const expiresAt = typeof payload?.exp === "number" ? payload.exp * 1000 : 0;
  const role = payload?.[roleClaim] ?? payload?.role;
  return expiresAt > Date.now() && role === "Administrator";
}

function isSensitiveAdminPath(pathname: string) {
  return pathname.startsWith("/admin/settings") || pathname.startsWith("/admin/users") || pathname.startsWith("/admin/stores");
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  const response = NextResponse.redirect(url);
  response.cookies.delete("accessToken");
  response.cookies.delete("refreshToken");
  response.cookies.delete("role");
  return response;
}

export function middleware(request: NextRequest) {
  const isLogin = request.nextUrl.pathname === "/admin/login";
  const token = request.cookies.get("accessToken")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;
  const hasRefreshSession = Boolean(refreshToken);

  if (isLogin) {
    if ((token && isAdminOrEmployee(token)) || hasRefreshSession) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    return NextResponse.next();
  }

  if ((token && isAdminOrEmployee(token)) || hasRefreshSession) {
    if (token && isSensitiveAdminPath(request.nextUrl.pathname) && !isAdministrator(token)) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    return NextResponse.next();
  }

  return redirectToLogin(request);
}

export const config = {
  matcher: ["/admin/:path*"]
};