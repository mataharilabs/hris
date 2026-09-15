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
): Promise<SsoEmployee[]> {
  const employees = await listEmployees({ companyId: ssoCompanyId });
  for (const e of employees) {
    await upsertEmployeeMirror(companyId, e);
  }

  // Prune: hapus cermin karyawan yang tak lagi ada di SSO (mis. admin platform
  // yang kini dikecualikan). Hanya saat fetch berhasil (list tidak kosong) agar
  // kegagalan koneksi tidak menghapus seluruh data.
  if (employees.length > 0) {
    const keepIds = employees.map((e) => e.id);
    await prisma.employee.deleteMany({
      where: { companyId, ssoUserId: { notIn: keepIds } },
    });
  }

  return employees;
}

async function upsertEmployeeMirror(companyId: string, e: SsoEmployee) {
  // Selalu diperbarui dari SSO (sumber = SSO).
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
    maritalStatus: (e.maritalStatus as
      | "SINGLE"
      | "MARRIED"
      | "DIVORCED"
      | "WIDOWED"
      | null) ?? null,
    joinDate: toDate(e.joinDate),
    nik: e.nik,
    npwp: e.npwp,
    addressKtp: e.addressKtp,
  };

  // Bisa diedit sendiri di HRIS → hanya backfill saat lokal masih kosong.
  const selfEditable = {
    birthDate: toDate(e.birthDate),
    emergencyName: e.emergencyName,
    emergencyRelation: e.emergencyRelation,
    emergencyPhone: e.emergencyPhone,
  };

  const existing =
    (await prisma.employee.findFirst({ where: { ssoUserId: e.id } })) ??
    (await prisma.employee.findUnique({ where: { email: e.email } }));

  if (existing) {
    const backfill: Record<string, unknown> = {};
    if (existing.birthDate == null && selfEditable.birthDate)
      backfill.birthDate = selfEditable.birthDate;
    if (existing.emergencyName == null && selfEditable.emergencyName)
      backfill.emergencyName = selfEditable.emergencyName;
    if (existing.emergencyRelation == null && selfEditable.emergencyRelation)
      backfill.emergencyRelation = selfEditable.emergencyRelation;
    if (existing.emergencyPhone == null && selfEditable.emergencyPhone)
      backfill.emergencyPhone = selfEditable.emergencyPhone;

    await prisma.employee.update({
      where: { id: existing.id },
      data: { ssoUserId: e.id, ...cache, ...backfill },
    });
    return existing.id;
  }

  const created = await prisma.employee.create({
    data: { email: e.email, ssoUserId: e.id, companyId, ...cache, ...selfEditable },
  });
  return created.id;
}
