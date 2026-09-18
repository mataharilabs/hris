import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify-client";
import { autoCheckinExpired } from "@/lib/meeting";

const REMIND_LEAD_MS = 5 * 60 * 1000; // ingatkan ~5 menit sebelum mulai

function wibHm(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// Cron per-menit (Vercel: "* * * * *"):
//  1) Auto check-in booking yang lewat toleransi 15 menit (tetap tertrack).
//  2) Kirim pengingat WA ke pembuat ~5 menit sebelum meeting mulai (sekali).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await autoCheckinExpired();

  const now = new Date();
  const soon = new Date(now.getTime() + REMIND_LEAD_MS);

  // Booking yang mulai dalam ≤5 menit ke depan & belum diingatkan.
  const due = await prisma.meetingBooking.findMany({
    where: {
      status: "BOOKED",
      reminderSentAt: null,
      startAt: { gt: now, lte: soon },
    },
    include: {
      room: { select: { name: true } },
      employee: { select: { name: true, phone: true } },
    },
  });

  // Tandai terkirim dulu (hindari kirim ganda bila cron tumpang tindih).
  if (due.length > 0) {
    await prisma.meetingBooking.updateMany({
      where: { id: { in: due.map((b) => b.id) } },
      data: { reminderSentAt: now },
    });
  }

  let sent = 0;
  for (const b of due) {
    if (!b.employee.phone) continue;
    await notify({
      to: { phone: b.employee.phone },
      subject: "Pengingat Meeting",
      message:
        `⏰ Halo ${b.employee.name}, meeting kamu sebentar lagi:\n\n` +
        `• Ruang: ${b.room.name}\n` +
        `• Kegiatan: ${b.title}\n` +
        `• Mulai: ${wibHm(b.startAt)} WIB (~5 menit lagi)\n\n` +
        `Jangan lupa hadir & *Check-in* di HRIS ya 🙌`,
    });
    sent++;
  }

  return Response.json({ ok: true, reminded: sent, due: due.length });
}
