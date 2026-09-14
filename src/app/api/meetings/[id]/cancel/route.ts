import { prisma } from "@/lib/prisma";
import { requireUser, isHr } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

// Batalkan booking (pembuat atau HR).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const b = await prisma.meetingBooking.findFirst({
      where: { id, room: { companyId: user.companyId } },
    });
    if (!b) return ok({ error: "Booking tidak ditemukan" }, 404);
    if (b.employeeId !== user.id && !isHr(user.role)) {
      return ok({ error: "Tidak diizinkan membatalkan booking ini" }, 403);
    }
    if (b.status === "CANCELLED" || b.status === "RELEASED") {
      return ok({ error: "Booking sudah tidak aktif" }, 400);
    }

    const updated = await prisma.meetingBooking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return ok(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
