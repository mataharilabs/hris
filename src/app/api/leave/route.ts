import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, isHr } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { annualLeaveBalance, dayCount } from "@/lib/leave";
import { notify } from "@/lib/notify-client";
import { listHrStaff } from "@/lib/sso-client";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatLeaveDays } from "@/lib/utils";
import { addPoint, LEAVE_SUBMITTED_POINTS } from "@/lib/gamification";

const schema = z.object({
  type: z.enum(["ANNUAL", "SICK", "SICK_CERTIFIED", "UNPAID", "OTHER"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isHalfDay: z.boolean().optional().default(false),
  halfDaySession: z.enum(["MORNING", "AFTERNOON"]).optional(),
  customDates: z.array(z.string()).optional(), // hari tidak berurutan
  reason: z.string().min(1, "Alasan cuti wajib diisi"),
  task: z.string().optional(),
  substituteId: z.string().min(1, "Pilih karyawan pengganti"),
  substituteCode: z.string().min(4, "Masukkan kode karyawan pengganti"),
  managerId: z.string().min(1, "Pilih Manager/Lead"),
  managerCode: z.string().min(4, "Masukkan kode Manager/Lead"),
});

// Beri tahu semua HR (HR_ADMIN/HR_STAFF) bahwa ada pengajuan cuti baru.
async function notifyHrNewLeave(
  companyId: string,
  ssoCompanyId: string | undefined,
  leave: {
    requesterName: string;
    type: string;
    start: Date;
    end: Date;
    days: number;
    isHalfDay: boolean;
    halfDaySession?: string | null;
    reason: string;
    task?: string | null;
    substituteName: string | null;
    managerName: string | null;
  }
) {
  const hr = await listHrStaff({ companyId: ssoCompanyId });
  if (hr.length === 0) return;

  // Ambil telepon HR dari cermin Employee lokal.
  const emails = hr.map((h) => h.email);
  const locals = await prisma.employee.findMany({
    where: { companyId, email: { in: emails } },
    select: { email: true, phone: true },
  });
  const phoneByEmail = new Map(locals.map((l) => [l.email, l.phone]));

  const daysLabel = formatLeaveDays(leave.days, leave.isHalfDay, leave.halfDaySession);
  const tanggalLine = leave.isHalfDay
    ? `• Tanggal: ${formatDate(leave.start)} (${daysLabel})\n`
    : `• Tanggal: ${formatDate(leave.start)} – ${formatDate(leave.end)} (${daysLabel})\n`;

  const message =
    `Pengajuan cuti baru dari *${leave.requesterName}*.\n` +
    `• Jenis: ${LEAVE_TYPE_LABELS[leave.type]}\n` +
    tanggalLine +
    `• Alasan: ${leave.reason}\n` +
    (leave.task ? `• Tugas: ${leave.task}\n` : "") +
    (leave.substituteName ? `• Pengganti: ${leave.substituteName}\n` : "") +
    (leave.managerName ? `• Manager/Lead: ${leave.managerName}\n` : "") +
    `\nMohon tinjau di HRIS. — HRIS AsiaCommerce`;

  await Promise.all(
    hr.map((h) =>
      notify({
        to: { email: h.email, phone: phoneByEmail.get(h.email) ?? null },
        subject: "Pengajuan Cuti Baru",
        message,
      })
    )
  );
}

// GET ?scope=mine|all|pending &year=N &status=X &q=X &month=N &type=X &page=N
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const scope = sp.get("scope") ?? "mine";
    const year = parseInt(sp.get("year") ?? "0") || new Date().getFullYear();
    const status = sp.get("status") ?? "";
    const q = sp.get("q") ?? "";
    const month = parseInt(sp.get("month") ?? "0") || 0;
    const type = sp.get("type") ?? "";
    const page = Math.max(1, parseInt(sp.get("page") ?? "1") || 1);
    const PAGE_SIZE = 8;

    if (scope === "mine") {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year + 1, 0, 1);
      const rows = await prisma.leaveRequest.findMany({
        where: {
          employeeId: user.id,
          startDate: { gte: yearStart, lt: yearEnd },
          ...(status ? { status: status as never } : {}),
          ...(q
            ? { reason: { contains: q, mode: "insensitive" } }
            : {}),
        },
        include: {
          substitute: { select: { name: true } },
          manager: { select: { name: true } },
        },
        orderBy: { startDate: "desc" },
      });
      return ok(rows);
    }

    if (!isHr(user.role)) return ok({ error: "Akses ditolak" }, 403);

    if (scope === "pending") {
      const rows = await prisma.leaveRequest.findMany({
        where: {
          status: "PENDING",
          employee: { companyId: user.companyId },
        },
        include: {
          employee: { select: { id: true, name: true } },
          substitute: { select: { name: true } },
          manager: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return ok(rows);
    }

    // scope === "all" — HR: semua karyawan, bisa difilter
    const andClauses: object[] = [
      { employee: { companyId: user.companyId } },
      { status: "APPROVED" },
    ];
    if (month) {
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 1);
      andClauses.push({ startDate: { gte: monthStart, lt: monthEnd } });
    }
    if (type) andClauses.push({ type });
    if (q) {
      andClauses.push({
        OR: [
          { reason: { contains: q, mode: "insensitive" } },
          { employee: { name: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
    const where = { AND: andClauses };

    const [rows, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: where as never,
        include: {
          employee: { select: { id: true, name: true } },
          substitute: { select: { name: true } },
          manager: { select: { name: true } },
        },
        orderBy: { startDate: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.leaveRequest.count({ where: where as never }),
    ]);

    return ok({
      rows: rows.map((r) => ({
        ...r,
        employeeName: r.employee.name,
        employeeId: r.employee.id,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const data = schema.parse(await req.json());

    // Hitung startDate, endDate, days — mendukung customDates (hari tidak berurutan)
    let start: Date;
    let end: Date;
    let days: number;

    if (data.customDates && data.customDates.length > 0) {
      const sorted = [...data.customDates].filter(Boolean).sort();
      if (sorted.length === 0) return ok({ error: "Tanggal tidak valid" }, 400);
      start = new Date(sorted[0]);
      end = new Date(sorted[sorted.length - 1]);
      days = sorted.length;
    } else {
      start = new Date(data.startDate);
      end = new Date(data.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return ok({ error: "Tanggal tidak valid" }, 400);
      }
      if (end < start) {
        return ok({ error: "Tanggal selesai sebelum tanggal mulai" }, 400);
      }
      if (data.isHalfDay && data.startDate !== data.endDate) {
        return ok({ error: "Cuti setengah hari hanya untuk satu tanggal" }, 400);
      }
      if (data.isHalfDay && !data.halfDaySession) {
        return ok({ error: "Pilih sesi (Pagi atau Siang) untuk cuti setengah hari" }, 400);
      }
      days = data.isHalfDay ? 0.5 : dayCount(start, end);
    }

    if (data.type === "ANNUAL" || data.type === "SICK") {
      const emp = await prisma.employee.findUnique({
        where: { id: user.id },
        select: { leaveQuota: true, leaveAdjustment: true },
      });
      const balance = await annualLeaveBalance(
        user.id,
        emp?.leaveQuota ?? 0,
        emp?.leaveAdjustment ?? 0
      );
      if (days > balance.remaining) {
        return ok(
          {
            error: `Sisa saldo cuti tidak cukup (sisa ${balance.remaining} hari, diminta ${days} hari)`,
          },
          400
        );
      }
    }

    if (data.managerId === data.substituteId) {
      return ok(
        { error: "Manager/Lead tidak boleh sama dengan karyawan pengganti" },
        400
      );
    }

    // Verifikasi dua kode: karyawan pengganti & Manager/Lead.
    const findOtp = (recipientId: string) =>
      prisma.substituteOtp.findFirst({
        where: {
          requesterId: user.id,
          substituteId: recipientId,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

    const subOtp = await findOtp(data.substituteId);
    if (!subOtp || subOtp.code !== data.substituteCode) {
      return ok({ error: "Kode karyawan pengganti salah atau kadaluarsa" }, 400);
    }
    const mgrOtp = await findOtp(data.managerId);
    if (!mgrOtp || mgrOtp.code !== data.managerCode) {
      return ok({ error: "Kode Manager/Lead salah atau kadaluarsa" }, 400);
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.substituteOtp.updateMany({
        where: { id: { in: [subOtp.id, mgrOtp.id] } },
        data: { consumedAt: new Date() },
      });
      const leave = await tx.leaveRequest.create({
        data: {
          employeeId: user.id,
          type: data.type,
          startDate: start,
          endDate: end,
          days,
          isHalfDay: data.isHalfDay ?? false,
          halfDaySession: data.isHalfDay ? (data.halfDaySession ?? null) : null,
          customDates: data.customDates && data.customDates.length > 0
            ? JSON.stringify([...data.customDates].sort())
            : null,
          reason: data.reason,
          task: data.task || null,
          substituteId: data.substituteId,
          managerId: data.managerId,
        },
      });
      await addPoint(
        tx,
        user.id,
        "LEAVE_SUBMITTED",
        LEAVE_SUBMITTED_POINTS,
        `Pengajuan cuti ${LEAVE_TYPE_LABELS[data.type]} (${days} hari)`
      );
      return leave;
    });

    // Notifikasi ke HR (best-effort, tak menggagalkan pengajuan).
    const [substitute, manager] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: data.substituteId },
        select: { name: true },
      }),
      prisma.employee.findUnique({
        where: { id: data.managerId },
        select: { name: true },
      }),
    ]);
    await notifyHrNewLeave(user.companyId, user.ssoCompanyId, {
      requesterName: user.name ?? user.email ?? "Karyawan",
      type: data.type,
      start,
      end,
      days,
      isHalfDay: data.isHalfDay ?? false,
      halfDaySession: data.isHalfDay ? (data.halfDaySession ?? null) : null,
      reason: data.reason,
      task: data.task,
      substituteName: substitute?.name ?? null,
      managerName: manager?.name ?? null,
    });

    return ok(created, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
