import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHr } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { notify } from "@/lib/notify-client";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

const schema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().optional(),
});

// Approve/Reject pengajuan cuti (HR only).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireHr();
    const { id } = await params;
    const { action, note } = schema.parse(await req.json());

    const leave = await prisma.leaveRequest.findFirst({
      where: { id, employee: { companyId: user.companyId } },
      include: { employee: { select: { name: true, email: true, phone: true } } },
    });
    if (!leave) return ok({ error: "Pengajuan tidak ditemukan" }, 404);
    if (leave.status !== "PENDING") {
      return ok({ error: "Pengajuan sudah diproses" }, 400);
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNote: note || null,
      },
    });

    // Notifikasi ke karyawan (best-effort).
    const status = action === "APPROVE" ? "DISETUJUI" : "DITOLAK";
    await notify({
      to: { email: leave.employee.email, phone: leave.employee.phone },
      subject: `Pengajuan Cuti ${status}`,
      message:
        `Halo ${leave.employee.name},\n\n` +
        `Pengajuan ${LEAVE_TYPE_LABELS[leave.type]} Anda ` +
        `(${formatDate(leave.startDate)} – ${formatDate(leave.endDate)}, ${leave.days} hari) ` +
        `telah *${status}*.` +
        (note ? `\nCatatan: ${note}` : "") +
        `\n\n— HRIS AsiaCommerce`,
    });

    return ok(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
