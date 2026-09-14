import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import {
  ensureMeetingRooms,
  autoReleaseExpired,
  hasOverlap,
} from "@/lib/meeting";
import { notifyGroup } from "@/lib/notify-client";

const TZ = "+07:00"; // WIB

function wibTime(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
function wibDate(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

// GET ?date=YYYY-MM-DD — jadwal ruang untuk satu hari (WIB).
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    await ensureMeetingRooms(user.companyId);
    await autoReleaseExpired(user.companyId);

    const dateStr =
      req.nextUrl.searchParams.get("date") ||
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
        new Date()
      );
    const dayStart = new Date(`${dateStr}T00:00:00${TZ}`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const [rooms, bookings] = await Promise.all([
      prisma.meetingRoom.findMany({
        where: { companyId: user.companyId, isActive: true },
        orderBy: { key: "asc" },
        select: { id: true, key: true, name: true },
      }),
      prisma.meetingBooking.findMany({
        where: {
          room: { companyId: user.companyId },
          status: { in: ["BOOKED", "CHECKED_IN"] },
          startAt: { gte: dayStart, lt: dayEnd },
        },
        orderBy: { startAt: "asc" },
        include: {
          room: { select: { id: true, name: true } },
          employee: { select: { name: true } },
        },
      }),
    ]);

    return ok({
      date: dateStr,
      meId: user.id,
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
        checkedInAt: b.checkedInAt ? b.checkedInAt.toISOString() : null,
        employeeId: b.employeeId,
        employeeName: b.employee.name,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

const createSchema = z.object({
  roomId: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  department: z.string().optional(),
  title: z.string().min(1, "Deskripsi kegiatan wajib diisi"),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    await ensureMeetingRooms(user.companyId);
    await autoReleaseExpired(user.companyId);
    const data = createSchema.parse(await req.json());

    const startAt = new Date(`${data.date}T${data.startTime}:00${TZ}`);
    const endAt = new Date(`${data.date}T${data.endTime}:00${TZ}`);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return ok({ error: "Tanggal/jam tidak valid" }, 400);
    }
    if (endAt <= startAt) {
      return ok({ error: "Jam selesai harus setelah jam mulai" }, 400);
    }

    const room = await prisma.meetingRoom.findFirst({
      where: { id: data.roomId, companyId: user.companyId, isActive: true },
      select: { id: true, name: true },
    });
    if (!room) return ok({ error: "Ruang tidak ditemukan" }, 404);

    if (await hasOverlap(room.id, startAt, endAt)) {
      return ok(
        { error: "Ruang sudah dipesan pada rentang jam tersebut" },
        409
      );
    }

    const emp = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { departmentName: true },
    });
    const department = data.department || emp?.departmentName || null;

    const created = await prisma.meetingBooking.create({
      data: {
        roomId: room.id,
        employeeId: user.id,
        title: data.title,
        department,
        startAt,
        endAt,
      },
    });

    // Notifikasi ke grup WhatsApp kantor (best-effort).
    await notifyGroup(
      `📅 *Ruang Meeting di-booking*\n` +
        `• Ruang: ${room.name}\n` +
        `• Tanggal: ${wibDate(startAt)}\n` +
        `• Jam: ${wibTime(startAt)}–${wibTime(endAt)} WIB\n` +
        (department ? `• Divisi: ${department}\n` : "") +
        `• Oleh: ${user.name ?? "Karyawan"}\n` +
        `• Agenda: ${data.title}\n\n— HRIS AsiaCommerce`
    );

    return ok(created, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
