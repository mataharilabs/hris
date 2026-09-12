import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, isHr } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { annualLeaveBalance, dayCount } from "@/lib/leave";
import { notify } from "@/lib/notify-client";
import { listHrStaff } from "@/lib/sso-client";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

const schema = z.object({
  type: z.enum(["ANNUAL", "SICK", "UNPAID", "OTHER"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().min(1, "Alasan cuti wajib diisi"),
  task: z.string().optional(),
  substituteId: z.string().min(1, "Pilih karyawan pengganti"),
  code: z.string().min(4, "Masukkan kode konfirmasi"),
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
    reason: string;
    task?: string | null;
    substituteName: string | null;
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

  const message =
    `Pengajuan cuti baru dari *${leave.requesterName}*.\n` +
    `• Jenis: ${LEAVE_TYPE_LABELS[leave.type]}\n` +
    `• Tanggal: ${formatDate(leave.start)} – ${formatDate(leave.end)} (${leave.days} hari)\n` +
    `• Alasan: ${leave.reason}\n` +
    (leave.task ? `• Tugas: ${leave.task}\n` : "") +
    (leave.substituteName ? `• Pengganti: ${leave.substituteName}\n` : "") +
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

// GET ?scope=mine|all — 'all' hanya untuk HR.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const scope = req.nextUrl.searchParams.get("scope") ?? "mine";
    const wantAll = scope === "all" && isHr(user.role);

    const rows = await prisma.leaveRequest.findMany({
      where: wantAll
        ? { employee: { companyId: user.companyId } }
        : { employeeId: user.id },
      include: { employee: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok(rows);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const data = schema.parse(await req.json());

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return ok({ error: "Tanggal tidak valid" }, 400);
    }
    if (end < start) {
      return ok({ error: "Tanggal selesai sebelum tanggal mulai" }, 400);
    }
    const days = dayCount(start, end);

    if (data.type === "ANNUAL") {
      const emp = await prisma.employee.findUnique({
        where: { id: user.id },
        select: { leaveQuota: true },
      });
      const balance = await annualLeaveBalance(user.id, emp?.leaveQuota ?? 0);
      if (days > balance.remaining) {
        return ok(
          {
            error: `Sisa cuti tahunan tidak cukup (sisa ${balance.remaining} hari, diminta ${days} hari)`,
          },
          400
        );
      }
    }

    // Verifikasi kode konfirmasi karyawan pengganti.
    const otp = await prisma.substituteOtp.findFirst({
      where: {
        requesterId: user.id,
        substituteId: data.substituteId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!otp || otp.code !== data.code) {
      return ok({ error: "Kode konfirmasi salah atau kadaluarsa" }, 400);
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.substituteOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
      return tx.leaveRequest.create({
        data: {
          employeeId: user.id,
          type: data.type,
          startDate: start,
          endDate: end,
          days,
          reason: data.reason,
          task: data.task || null,
          substituteId: data.substituteId,
        },
      });
    });

    // Notifikasi ke HR (best-effort, tak menggagalkan pengajuan).
    const substitute = await prisma.employee.findUnique({
      where: { id: data.substituteId },
      select: { name: true },
    });
    await notifyHrNewLeave(user.companyId, user.ssoCompanyId, {
      requesterName: user.name ?? user.email ?? "Karyawan",
      type: data.type,
      start,
      end,
      days,
      reason: data.reason,
      task: data.task,
      substituteName: substitute?.name ?? null,
    });

    return ok(created, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
