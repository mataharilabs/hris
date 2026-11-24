import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

// Batalkan blast yang masih PENDING.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(["HR_ADMIN"]);
    const { id } = await params;

    const blast = await prisma.waBlast.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true, status: true },
    });
    if (!blast) return ok({ error: "Tidak ditemukan" }, 404);
    if (blast.status !== "PENDING") {
      return ok({ error: "Hanya blast berstatus Dijadwalkan yang bisa dibatalkan" }, 400);
    }

    await prisma.waBlast.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return ok({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
