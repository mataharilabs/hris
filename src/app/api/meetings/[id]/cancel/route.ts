import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isHr } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

// Batalkan booking (pembuat atau HR). scope "series" → batalkan sisa seri (mendatang).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const scope = body?.scope === "series" ? "series" : "one";

    const b = await prisma.meetingBooking.findFirst({
      where: { id, room: { companyId: user.companyId } },
    });
    if (!b) return ok({ error: "Booking tidak ditemukan" }, 404);
    if (b.employeeId !== user.id && !isHr(user.role)) {
      return ok({ error: "Tidak diizinkan membatalkan booking ini" }, 403);
    }

    if (scope === "series" && b.seriesId) {
      const res = await prisma.meetingBooking.updateMany({
        where: {
          seriesId: b.seriesId,
          status: { in: ["BOOKED", "CHECKED_IN"] },
          startAt: { gte: new Date() },
        },
        data: { status: "CANCELLED" },
      });
      return ok({ cancelled: res.count, scope: "series" });
    }

    if (b.status === "CANCELLED" || b.status === "RELEASED") {
      return ok({ error: "Booking sudah tidak aktif" }, 400);
    }
    await prisma.meetingBooking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return ok({ cancelled: 1, scope: "one" });
  } catch (e) {
    return handleApiError(e);
  }
}
