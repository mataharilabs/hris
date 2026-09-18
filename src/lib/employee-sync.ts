import { prisma } from "@/lib/prisma";
import { listEmployees, type SsoEmployee } from "@/lib/sso-client";

function toDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Email selalu disimpan lowercase agar unik & tak sensitif huruf besar/kecil. */
export function normalizeEmail(v: string): string {
  return v.trim().toLowerCase();
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

type EmployeeRow = NonNullable<
  Awaited<ReturnType<typeof prisma.employee.findFirst>>
>;

/** Pilih nilai pertama yang terisi (mengutamakan urutan baris yang diberikan). */
function firstNonNull<T>(rows: EmployeeRow[], pick: (r: EmployeeRow) => T | null | undefined): T | null {
  for (const r of rows) {
    const v = pick(r);
    if (v != null) return v as T;
  }
  return null;
}

/**
 * Gabungkan baris duplikat ke baris utama: pindahkan semua relasi lalu hapus
 * baris duplikat. Dipakai untuk memperbaiki cermin ganda (mis. email berubah
 * huruf besar/kecil sehingga sempat terbuat dua baris untuk orang yang sama).
 */
async function mergeInto(primaryId: string, dupId: string) {
  if (primaryId === dupId) return;
  await prisma.$transaction(async (tx) => {
    // Relasi cuti (pemohon, peninjau, pengganti, manager).
    await tx.leaveRequest.updateMany({ where: { employeeId: dupId }, data: { employeeId: primaryId } });
    await tx.leaveRequest.updateMany({ where: { reviewedById: dupId }, data: { reviewedById: primaryId } });
    await tx.leaveRequest.updateMany({ where: { substituteId: dupId }, data: { substituteId: primaryId } });
    await tx.leaveRequest.updateMany({ where: { managerId: dupId }, data: { managerId: primaryId } });
    // Reimbursement (pemohon & peninjau).
    await tx.reimbursementRequest.updateMany({ where: { employeeId: dupId }, data: { employeeId: primaryId } });
    await tx.reimbursementRequest.updateMany({ where: { reviewedById: dupId }, data: { reviewedById: primaryId } });
    // Booking ruang meeting.
    await tx.meetingBooking.updateMany({ where: { employeeId: dupId }, data: { employeeId: primaryId } });
    // Poin & kudos.
    await tx.pointEntry.updateMany({ where: { employeeId: dupId }, data: { employeeId: primaryId } });
    await tx.kudos.updateMany({ where: { senderId: dupId }, data: { senderId: primaryId } });
    await tx.kudos.updateMany({ where: { recipientId: dupId }, data: { recipientId: primaryId } });
    await tx.kudosComment.updateMany({ where: { employeeId: dupId }, data: { employeeId: primaryId } });
    // Kudos like: hindari bentrok unique(kudosId, employeeId) → buang yang duplikat.
    const primLikes = await tx.kudosLike.findMany({
      where: { employeeId: primaryId },
      select: { kudosId: true },
    });
    if (primLikes.length > 0) {
      await tx.kudosLike.deleteMany({
        where: { employeeId: dupId, kudosId: { in: primLikes.map((l) => l.kudosId) } },
      });
    }
    await tx.kudosLike.updateMany({ where: { employeeId: dupId }, data: { employeeId: primaryId } });
    // OTP (kolom string, bukan relasi FK).
    await tx.substituteOtp.updateMany({ where: { requesterId: dupId }, data: { requesterId: primaryId } });
    await tx.substituteOtp.updateMany({ where: { substituteId: dupId }, data: { substituteId: primaryId } });

    await tx.employee.delete({ where: { id: dupId } });
  });
}

async function upsertEmployeeMirror(companyId: string, e: SsoEmployee) {
  const email = normalizeEmail(e.email);

  // Selalu diperbarui dari SSO (sumber = SSO) — termasuk email yang dinormalisasi.
  const cache = {
    email,
    name: e.name ?? email,
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

  // Cocokkan berdasarkan ssoUserId ATAU email (tanpa peduli huruf besar/kecil),
  // agar perubahan email tidak membuat baris ganda.
  const candidates = await prisma.employee.findMany({
    where: {
      OR: [{ ssoUserId: e.id }, { email: { equals: email, mode: "insensitive" } }],
    },
    orderBy: { createdAt: "asc" },
  });

  if (candidates.length === 0) {
    const created = await prisma.employee.create({
      data: { ssoUserId: e.id, companyId, ...cache, ...selfEditable },
    });
    return created.id;
  }

  // Baris utama: prioritaskan yang sudah tertaut ssoUserId ini; jika tidak ada,
  // ambil baris terlama.
  const primary =
    candidates.find((c) => c.ssoUserId === e.id) ?? candidates[0];

  // Gabungkan duplikat (bila ada) ke baris utama sebelum update email/unik.
  const dupes = candidates.filter((c) => c.id !== primary.id);
  for (const d of dupes) {
    await mergeInto(primary.id, d.id);
  }

  // Backfill field milik-HRIS dari baris manapun yang terisi (utama diutamakan),
  // agar data tidak hilang saat menggabungkan duplikat.
  const rowsByPriority = [primary, ...dupes];
  const hrisBackfill: Record<string, unknown> = {};
  if (primary.monthlySalary == null) {
    const v = firstNonNull(rowsByPriority, (r) => r.monthlySalary);
    if (v != null) hrisBackfill.monthlySalary = v;
  }
  if (primary.leaveQuota === 12) {
    const v = dupes.map((d) => d.leaveQuota).find((q) => q !== 12);
    if (v != null) hrisBackfill.leaveQuota = v;
  }
  if (primary.leaveAdjustment === 0) {
    const v = dupes.map((d) => d.leaveAdjustment).find((a) => a !== 0);
    if (v != null) hrisBackfill.leaveAdjustment = v;
  }
  if (primary.photoDataUrl == null) {
    const v = firstNonNull(rowsByPriority, (r) => r.photoDataUrl);
    if (v != null) hrisBackfill.photoDataUrl = v;
  }
  if (primary.onboardingClaimedAt == null) {
    const v = firstNonNull(rowsByPriority, (r) => r.onboardingClaimedAt);
    if (v != null) hrisBackfill.onboardingClaimedAt = v;
  }

  // Backfill field self-editable hanya bila baris utama masih kosong.
  const backfill: Record<string, unknown> = {};
  const curBirth = (hrisBackfill.birthDate as Date) ?? primary.birthDate;
  if (curBirth == null && selfEditable.birthDate) backfill.birthDate = selfEditable.birthDate;
  if (primary.emergencyName == null && selfEditable.emergencyName)
    backfill.emergencyName = selfEditable.emergencyName;
  if (primary.emergencyRelation == null && selfEditable.emergencyRelation)
    backfill.emergencyRelation = selfEditable.emergencyRelation;
  if (primary.emergencyPhone == null && selfEditable.emergencyPhone)
    backfill.emergencyPhone = selfEditable.emergencyPhone;

  await prisma.employee.update({
    where: { id: primary.id },
    data: { ssoUserId: e.id, companyId, ...cache, ...hrisBackfill, ...backfill },
  });
  return primary.id;
}
