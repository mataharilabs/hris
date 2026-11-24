import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

const TZ = "+07:00";

function wibHm(d: Date): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = p.find((x) => x.type === "hour")?.value ?? "00";
  const m = p.find((x) => x.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

// GET ?roomId=X&date=YYYY-MM-DD&start=HH:MM&end=HH:MM
// Cek slot tersedia atau bentrok (real-time, dari modal booking).
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const roomId = sp.get("roomId") ?? "";
    const date = sp.get("date") ?? "";
    const start = sp.get("start") ?? "";
    const end = sp.get("end") ?? "";

    if (!roomId || !date || !start || !end) {
      return ok({ available: false, error: "Parameter kurang" }, 400);
    }
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      return ok({ available: false, error: "Format jam tidak valid" }, 400);
    }

    const startAt = new Date(`${date}T${start}:00${TZ}`);
    const endAt = new Date(`${date}T${end}:00${TZ}`);

    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
      return ok({ available: false, error: "Tanggal/jam tidak valid" }, 400);
    }
    if (endAt <= startAt) {
      return ok({ available: false, error: "Jam selesai harus setelah jam mulai" }, 400);
    }

    const room = await prisma.meetingRoom.findFirst({
      where: { id: roomId, companyId: user.companyId, isActive: true },
    });
    if (!room) return ok({ available: false, error: "Ruang tidak ditemukan" }, 404);

    const clash = await prisma.meetingBooking.findFirst({
      where: {
        roomId,
        status: { in: ["BOOKED", "CHECKED_IN", "AUTO_CHECKED_IN"] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      include: { employee: { select: { name: true } } },
    });

    if (clash) {
      return ok({
        available: false,
        clash: {
          title: clash.title,
          start: wibHm(clash.startAt),
          end: wibHm(clash.endAt),
          employeeName: clash.employee.name,
        },
      });
    }

    return ok({ available: true });
  } catch (e) {
    return handleApiError(e);
  }
}
