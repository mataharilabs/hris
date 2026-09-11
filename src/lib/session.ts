import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type Role = "HR_ADMIN" | "HR_STAFF" | "EMPLOYEE";

export type SessionUser = {
  /** id Employee lokal (dipakai untuk relasi reviewer/pemohon). */
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role;
  companyId: string;
  companyName: string;
  /** companyId di SSO (untuk service call ke SSO). Kosong di mode non-SSO. */
  ssoCompanyId?: string;
};

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

const ROLES: Role[] = ["HR_ADMIN", "HR_STAFF", "EMPLOYEE"];
const ssoEnabled = () => process.env.SSO_ENABLED === "true";

type RawUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  companyId?: string;
  companyName?: string;
  apps?: Record<string, string>;
};

async function getRawUser(): Promise<RawUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as RawUser;
}

/** Apakah ada sesi login (mentah), tanpa memandang akses HRIS. */
export async function isAuthenticated(): Promise<boolean> {
  return (await getRawUser()) !== null;
}

async function defaultCompany() {
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: { name: "AsiaCommerce", slug: "asiacommerce" },
    });
  }
  return company;
}

/**
 * Mode SSO: identitas dari SSO, tetapi Employee direferensikan LOKAL (match email).
 * Return null bila user tidak punya akses ke aplikasi HRIS.
 */
export async function ensureLocalEmployee(claims: {
  email?: string | null;
  name?: string | null;
  appRole?: string;
}): Promise<SessionUser | null> {
  const role =
    claims.appRole && ROLES.includes(claims.appRole as Role)
      ? (claims.appRole as Role)
      : null;
  if (!role || !claims.email) return null; // tanpa akses HRIS

  const existing = await prisma.employee.findUnique({
    where: { email: claims.email },
    include: { company: { select: { name: true } } },
  });

  if (existing) {
    if (existing.role !== role) {
      await prisma.employee.update({
        where: { id: existing.id },
        data: { role },
      });
    }
    return {
      id: existing.id,
      name: existing.name,
      email: existing.email,
      role,
      companyId: existing.companyId,
      companyName: existing.company.name,
    };
  }

  const company = await defaultCompany();
  const created = await prisma.employee.create({
    data: {
      email: claims.email,
      name: claims.name ?? claims.email,
      role,
      companyId: company.id,
    },
    include: { company: { select: { name: true } } },
  });
  return {
    id: created.id,
    name: created.name,
    email: created.email,
    role,
    companyId: created.companyId,
    companyName: created.company.name,
  };
}

/** Ambil user efektif, atau null (belum login ATAU tanpa akses HRIS di mode SSO). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const raw = await getRawUser();
  if (!raw) return null;
  if (ssoEnabled()) {
    const local = await ensureLocalEmployee({
      email: raw.email,
      name: raw.name,
      appRole: raw.apps?.["HRIS"],
    });
    return local ? { ...local, ssoCompanyId: raw.companyId } : null;
  }
  return null;
}

/** Wajib login + punya akses HRIS. 401 jika belum login, 403 jika tanpa akses. */
export async function requireUser(): Promise<SessionUser> {
  const raw = await getRawUser();
  if (!raw) throw new AuthError("Tidak terautentikasi", 401);
  if (ssoEnabled()) {
    const local = await ensureLocalEmployee({
      email: raw.email,
      name: raw.name,
      appRole: raw.apps?.["HRIS"],
    });
    if (!local) {
      throw new AuthError("Anda tidak memiliki akses ke aplikasi HRIS", 403);
    }
    return { ...local, ssoCompanyId: raw.companyId };
  }
  throw new AuthError("SSO belum diaktifkan", 401);
}

/** Wajib salah satu role. Throw AuthError(403) jika tidak cocok. */
export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new AuthError("Akses ditolak", 403);
  }
  return user;
}

/** Wajib HR (admin/staff). */
export async function requireHr(): Promise<SessionUser> {
  return requireRole(["HR_ADMIN", "HR_STAFF"]);
}

export function isHr(role: Role): boolean {
  return role === "HR_ADMIN" || role === "HR_STAFF";
}
