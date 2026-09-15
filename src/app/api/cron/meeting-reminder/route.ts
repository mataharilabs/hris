import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyGroup } from "@/lib/notify-client";

const TZ = "+07:00";

function wibTime(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// Cron 09:00 WIB (Vercel: "0 2 * * *"). Ringkasan jadwal meeting hari ini → grup WA.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  // Hari kerja Senin–Sabtu. Minggu (getUTCDay() === 0) → tidak kirim.
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  if (weekday === 0) {
    return Response.json({ ok: true, skipped: "sunday" });
  }

  const dayStart = new Date(`${today}T00:00:00${TZ}`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const bookings = await prisma.meetingBooking.findMany({
    where: {
      status: { in: ["BOOKED", "CHECKED_IN"] },
      startAt: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { startAt: "asc" },
    include: {
      room: { select: { name: true } },
      employee: { select: { name: true } },
    },
  });

  const dateLabel = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(dayStart);

  const footer =
    `\n\nBook & lihat jadwal ruang meeting hanya di *hris.asiacommerce.net* 🙏`;

  let message: string;
  if (bookings.length === 0) {
    message =
      `Selamat pagi, teman-teman 👋\n\n` +
      `Hari ini (${dateLabel}) belum ada ruang meeting yang di-book. ` +
      `Ruangan bebas dipakai — selamat bekerja! 💪` +
      footer;
  } else {
    const lines = bookings.map(
      (b, i) =>
        `${i + 1}. ${wibTime(b.startAt)}–${wibTime(b.endAt)} • ${b.room.name} — ` +
        `${b.title}${b.department ? ` (${b.department})` : ""} — ${b.employee.name}`
    );
    message =
      `Selamat pagi, teman-teman 👋\n\n` +
      `Berikut jadwal meeting hari ini (${dateLabel}):\n\n` +
      `${lines.join("\n")}\n\n` +
      `Buat yang sudah booking, jangan lupa *Check-in* di HRIS ya biar ruangannya tidak otomatis dilepas. 🙌` +
      footer;
  }

  await notifyGroup(message);
  return Response.json({ ok: true, count: bookings.length });
}
