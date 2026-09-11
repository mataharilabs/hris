import { prisma } from "@/lib/prisma";
import { listEmployees, type SsoEmployee } from "@/lib/sso-client";

function toDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Sinkronkan Employee lokal dari master karyawan di SSO.
 * Field profil (cache) selalu diperbarui; field milik-HRIS
 * (monthlySalary, leaveQuota, role) TIDAK ditimpa.
 */
export async function syncEmployeesFromSSO(
  companyId: string,
  ssoCompanyId?: string
): Promise<number> {
  const employees = await listEmployees({ companyId: ssoCompanyId });
  for (const e of employees) {
    await upsertEmployeeMirror(companyId, e);
  }
  return employees.length;
}

async function upsertEmployeeMirror(companyId: string, e: SsoEmployee) {
  const cache = {
    name: e.name ?? e.email,
    phone: e.phone,
    employeeCode: e.employeeCode,
    jobTitle: e.jobTitle,
    level: e.level,
    departmentName: e.departmentName,
    officeName: e.officeName,
    employmentStatus: e.employmentStatus ?? null,
    gender: e.gender ?? null,
    birthDate: toDate(e.birthDate),
    joinDate: toDate(e.joinDate),
  };

  const existing =
    (await prisma.employee.findFirst({ where: { ssoUserId: e.id } })) ??
    (await prisma.employee.findUnique({ where: { email: e.email } }));

  if (existing) {
    await prisma.employee.update({
      where: { id: existing.id },
      data: { ssoUserId: e.id, ...cache },
    });
    return existing.id;
  }

  const created = await prisma.employee.create({
    data: { email: e.email, ssoUserId: e.id, companyId, ...cache },
  });
  return created.id;
}
