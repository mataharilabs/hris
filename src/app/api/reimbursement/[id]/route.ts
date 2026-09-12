import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHr } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { notify } from "@/lib/notify-client";
import { formatCurrency } from "@/lib/utils";

const schema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().optional(),
});

// Approve/Reject reimbursement (HR only).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireHr();
    const { id } = await params;
    const { action, note } = schema.parse(await req.json());

    const item = await prisma.reimbursementRequest.findFirst({
      where: { id, employee: { companyId: user.companyId } },
      include: { employee: { select: { name: true, email: true, phone: true } } },
    });
    if (!item) return ok({ error: "Pengajuan tidak ditemukan" }, 404);
    if (item.status !== "PENDING") {
      return ok({ error: "Pengajuan sudah diproses" }, 400);
    }

    const updated = await prisma.reimbursementRequest.update({
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
      to: { email: item.employee.email, phone: item.employee.phone },
      subject: `Reimbursement ${status}`,
      message:
        `Halo ${item.employee.name},\n\n` +
        `Reimbursement "${item.title}" (${item.category}) sebesar ` +
        `${formatCurrency(item.amount)} telah *${status}*.` +
        (note ? `\nCatatan: ${note}` : "") +
        `\n\n— HRIS AsiaCommerce`,
    });

    return ok(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
