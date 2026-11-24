import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isHr } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

// DELETE — HR Admin hapus data booking secara permanen.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!isHr(user.role)) {
      return ok({ error: "Hanya HR yang dapat menghapus data meeting" }, 403);
    }
    const { id } = await params;
    const b = await prisma.meetingBooking.findFirst({
      where: { id, room: { companyId: user.companyId } },
    });
    if (!b) return ok({ error: "Booking tidak ditemukan" }, 404);
    await prisma.meetingBooking.delete({ where: { id } });
    return ok({ deleted: 1 });
  } catch (e) {
    return handleApiError(e);
  }
}
