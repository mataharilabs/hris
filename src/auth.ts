import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";

// HRIS = SSO-only. Provider lokal sengaja mengembalikan null: seluruh autentikasi
// dilakukan di SSO (sesi dibaca dari cookie bersama .asiacommerce.net).
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize() {
        return null; // tidak ada login lokal — arahkan ke SSO
      },
    }),
  ],
});
