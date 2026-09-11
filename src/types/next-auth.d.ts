import type { DefaultSession } from "next-auth";

type AppRoleMap = Record<string, string>;

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "HR_ADMIN" | "HR_STAFF" | "EMPLOYEE";
      companyId: string;
      companyName: string;
      apps?: AppRoleMap; // klaim SSO: akses per-aplikasi
    } & DefaultSession["user"];
  }

  interface User {
    role?: "HR_ADMIN" | "HR_STAFF" | "EMPLOYEE";
    companyId?: string;
    companyName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: "HR_ADMIN" | "HR_STAFF" | "EMPLOYEE";
    companyId?: string;
    companyName?: string;
    apps?: AppRoleMap;
  }
}
