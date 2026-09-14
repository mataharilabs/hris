import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const SSO_ENABLED = process.env.SSO_ENABLED === "true";
const SSO_URL = process.env.SSO_URL ?? "";

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;

  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/no-access") ||
    path.startsWith("/public") ||
    path === "/";

  const isLoggedIn = !!req.auth?.user;
  if (isPublic || isLoggedIn) return NextResponse.next();

  // Belum login pada route terproteksi → arahkan ke SSO
  if (SSO_ENABLED && SSO_URL) {
    const url = `${SSO_URL}/login?callbackUrl=${encodeURIComponent(nextUrl.href)}`;
    return NextResponse.redirect(url);
  }
  const url = new URL("/login", nextUrl.origin);
  url.searchParams.set("callbackUrl", nextUrl.href);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
