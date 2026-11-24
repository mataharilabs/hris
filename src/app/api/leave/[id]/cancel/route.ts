import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

// POST — karyawan membatalkan pengajuan cutunya sendiri (hanya yang PENDING).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const leave = await prisma.leaveRequest.findFirst({
      where: { id, employeeId: user.id },
      select: { id: true, status: true },
    });

    if (!leave) return ok({ error: "Pengajuan tidak ditemukan" }, 404);
    if (leave.status !== "PENDING") {
      return ok({ error: "Hanya pengajuan berstatus Menunggu yang bisa dibatalkan" }, 400);
    }

    await prisma.leaveRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return ok({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
