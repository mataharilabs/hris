import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { canCheckIn } from "@/lib/meeting";

// Check-in booking sendiri agar meeting aktif (dalam window ±15 menit dari mulai).
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
    if (b.employeeId !== user.id) {
      return ok({ error: "Hanya pembuat yang bisa check-in" }, 403);
    }
    if (b.status !== "BOOKED") {
      return ok({ error: "Booking tidak dalam status dapat check-in" }, 400);
    }
    if (!canCheckIn(b.startAt)) {
      return ok(
        { error: "Check-in hanya dalam 15 menit sebelum/sesudah jam mulai" },
        400
      );
    }

    const updated = await prisma.meetingBooking.update({
      where: { id },
      data: { status: "CHECKED_IN", checkedInAt: new Date() },
    });
    return ok(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
