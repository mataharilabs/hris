import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { randomUUID } from "node:crypto";
import {
  ensureMeetingRooms,
  autoReleaseExpired,
  hasOverlap,
  generateOccurrenceDates,
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
        seriesId: b.seriesId,
        employeeId: b.employeeId,
        employeeName: b.employee.name,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

const recurrenceSchema = z.object({
  freq: z.enum(["WEEKLY", "WEEKDAY", "MONTHLY"]),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  endMode: z.enum(["date", "count"]),
  untilDate: z.string().optional(),
  count: z.number().int().min(1).max(100).optional(),
});

const createSchema = z.object({
  roomId: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  department: z.string().optional(),
  title: z.string().min(1, "Deskripsi kegiatan wajib diisi"),
  recurrence: recurrenceSchema.optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    await ensureMeetingRooms(user.companyId);
    await autoReleaseExpired(user.companyId);
    const data = createSchema.parse(await req.json());

    // Validasi jam (sama untuk tiap occurrence).
    const t0 = new Date(`${data.date}T${data.startTime}:00${TZ}`);
    const t1 = new Date(`${data.date}T${data.endTime}:00${TZ}`);
    if (Number.isNaN(t0.getTime()) || Number.isNaN(t1.getTime())) {
      return ok({ error: "Tanggal/jam tidak valid" }, 400);
    }
    if (t1 <= t0) {
      return ok({ error: "Jam selesai harus setelah jam mulai" }, 400);
    }

    const room = await prisma.meetingRoom.findFirst({
      where: { id: data.roomId, companyId: user.companyId, isActive: true },
      select: { id: true, name: true },
    });
    if (!room) return ok({ error: "Ruang tidak ditemukan" }, 404);

    const emp = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { departmentName: true },
    });
    const department = data.department || emp?.departmentName || null;

    // Tanggal kejadian: sekali, atau seri (recurring).
    const dates = data.recurrence
      ? generateOccurrenceDates(data.date, data.recurrence)
      : [data.date];
    if (dates.length === 0) {
      return ok({ error: "Tidak ada tanggal yang cocok dengan pola" }, 400);
    }

    const seriesId = data.recurrence ? randomUUID() : null;
    const rows: { startAt: Date; endAt: Date }[] = [];
    const skipped: string[] = [];
    for (const d of dates) {
      const s = new Date(`${d}T${data.startTime}:00${TZ}`);
      const e = new Date(`${d}T${data.endTime}:00${TZ}`);
      if (await hasOverlap(room.id, s, e)) {
        skipped.push(d);
        continue;
      }
      rows.push({ startAt: s, endAt: e });
    }

    if (rows.length === 0) {
      return ok(
        { error: "Semua tanggal bentrok dengan booking lain", skipped },
        409
      );
    }

    await prisma.meetingBooking.createMany({
      data: rows.map((r) => ({
        roomId: room.id,
        employeeId: user.id,
        title: data.title,
        department,
        startAt: r.startAt,
        endAt: r.endAt,
        seriesId,
      })),
    });

    // Notifikasi ke grup WhatsApp kantor (best-effort).
    if (rows.length === 1 && !seriesId) {
      const r = rows[0];
      await notifyGroup(
        `📅 *Ruang Meeting di-booking*\n` +
          `• Ruang: ${room.name}\n` +
          `• Tanggal: ${wibDate(r.startAt)}\n` +
          `• Jam: ${wibTime(r.startAt)}–${wibTime(r.endAt)} WIB\n` +
          (department ? `• Divisi: ${department}\n` : "") +
          `• Oleh: ${user.name ?? "Karyawan"}\n` +
          `• Agenda: ${data.title}\n\n— HRIS AsiaCommerce`
      );
    } else {
      const first = rows[0];
      const last = rows[rows.length - 1];
      await notifyGroup(
        `🔁 *Meeting Berulang di-booking*\n` +
          `• Ruang: ${room.name}\n` +
          `• Jam: ${wibTime(first.startAt)}–${wibTime(first.endAt)} WIB\n` +
          `• ${rows.length} pertemuan: ${wibDate(first.startAt)} s/d ${wibDate(last.startAt)}\n` +
          (department ? `• Divisi: ${department}\n` : "") +
          `• Oleh: ${user.name ?? "Karyawan"}\n` +
          `• Agenda: ${data.title}\n` +
          (skipped.length ? `• Dilewati (bentrok): ${skipped.length} tanggal\n` : "") +
          `\n— HRIS AsiaCommerce`
      );
    }

    return ok({ created: rows.length, skipped }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
