import type { NextAuthConfig } from "next-auth";

const isProd = process.env.NODE_ENV === "production";
// Samakan dengan SSO: di produksi cookie ter-scope ke seluruh subdomain
// agar sesi SSO terbaca oleh HRIS (fallback bila COOKIE_DOMAIN lupa di-set).
const cookieDomain =
  process.env.COOKIE_DOMAIN || (isProd ? ".asiacommerce.net" : undefined);

// Nama cookie HARUS identik dengan SSO (default Auth.js) agar JWT bisa
// didekripsi lintas app (nama cookie = salt enkripsi).
const sessionCookieName = isProd
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

// Konfigurasi edge-safe (tanpa Prisma / bcrypt). Dipakai middleware & auth.ts.
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: sessionCookieName,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProd,
        domain: cookieDomain, // .asiacommerce.net di produksi → cookie SSO terbaca
      },
    },
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      const isPublic =
        path.startsWith("/login") ||
        path.startsWith("/no-access") ||
        path === "/";

      if (isPublic) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      // Hanya jalan saat login lokal (mode non-SSO). Cookie SSO tidak memicu ini.
      if (user) {
        token.id = user.id as string;
        if (user.companyId) token.companyId = user.companyId;
        if (user.companyName) token.companyName = user.companyName;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id ?? token.sub) as string;
        session.user.role = token.role as typeof session.user.role;
        session.user.companyId = (token.companyId as string) ?? "";
        session.user.companyName = (token.companyName as string) ?? "";
        session.user.isSuperAdmin = Boolean(token.isSuperAdmin);
        // Klaim SSO: map akses per-aplikasi (dipakai untuk turunkan role HRIS).
        session.user.apps = (token.apps as Record<string, string>) ?? undefined;
      }
      return session;
    },
  },
  providers: [], // diisi di auth.ts
} satisfies NextAuthConfig;
