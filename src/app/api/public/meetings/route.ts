import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureMeetingRooms, autoReleaseExpired } from "@/lib/meeting";

const TZ = "+07:00";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      // Publik — bisa dibaca lintas-origin (mis. landing SSO).
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// Publik (tanpa login): jadwal ruang meeting satu hari. Hanya info non-sensitif.
export async function GET(req: NextRequest) {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) return json({ date: null, rooms: [], bookings: [] });

  await ensureMeetingRooms(company.id);
  await autoReleaseExpired(company.id);

  const dateStr =
    req.nextUrl.searchParams.get("date") ||
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
      new Date()
    );
  const dayStart = new Date(`${dateStr}T00:00:00${TZ}`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [rooms, bookings] = await Promise.all([
    prisma.meetingRoom.findMany({
      where: { companyId: company.id, isActive: true },
      orderBy: { key: "asc" },
      select: { id: true, name: true },
    }),
    prisma.meetingBooking.findMany({
      where: {
        room: { companyId: company.id },
        status: { in: ["BOOKED", "CHECKED_IN"] },
        startAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { startAt: "asc" },
      include: {
        room: { select: { name: true } },
        employee: { select: { name: true } },
      },
    }),
  ]);

  return json({
    date: dateStr,
    rooms,
    bookings: bookings.map((b) => ({
      id: b.id,
      roomId: b.roomId,
      roomName: b.room.name,
      title: b.title,
      department: b.department,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      status: b.status,
      seriesId: b.seriesId,
      employeeName: b.employee.name,
    })),
  });
}
