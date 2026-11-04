import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { dayCount } from "@/lib/leave";

const schema = z.object({
  type: z.enum(["ANNUAL", "SICK", "SICK_CERTIFIED", "UNPAID", "OTHER"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isHalfDay: z.boolean().optional().default(false),
  halfDaySession: z.enum(["MORNING", "AFTERNOON"]).optional(),
  reason: z.string().optional(),
});

// Tambah data cuti manual untuk karyawan (HR Admin). Langsung berstatus
// DISETUJUI — tanpa OTP/pengganti — dicatat sebagai ditinjau oleh HR.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(["HR_ADMIN"]);
    const { id } = await params;
    const data = schema.parse(await req.json());

    const emp = await prisma.employee.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true },
    });
    if (!emp) return ok({ error: "Karyawan tidak ditemukan" }, 404);

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return ok({ error: "Tanggal tidak valid" }, 400);
    }
    if (end < start) {
      return ok({ error: "Tanggal selesai sebelum tanggal mulai" }, 400);
    }
    if (data.isHalfDay && data.startDate !== data.endDate) {
      return ok({ error: "Cuti setengah hari hanya untuk satu tanggal" }, 400);
    }

    const days = data.isHalfDay ? 0.5 : dayCount(start, end);

    const created = await prisma.leaveRequest.create({
      data: {
        employeeId: id,
        type: data.type,
        startDate: start,
        endDate: end,
        days,
        isHalfDay: data.isHalfDay ?? false,
        halfDaySession: data.isHalfDay ? (data.halfDaySession ?? null) : null,
        reason: data.reason || null,
        status: "APPROVED",
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNote: "Ditambahkan manual oleh HR",
      },
    });
    return ok(created, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
