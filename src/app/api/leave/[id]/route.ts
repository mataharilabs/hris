import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHr } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

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
    return ok(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
