import { prisma } from "@/lib/prisma";

export const GRACE_MS = 15 * 60 * 1000; // toleransi check-in 15 menit

const ROOM_SEED = [
  { key: "UTAMA", name: "Ruang Meeting Utama" },
  { key: "SERVER", name: "Ruang Meeting Server" },
  { key: "GUDANG", name: "Ruang Gudang" },
];

/** Pastikan 2 ruang rapat tersedia (idempotent). */
export async function ensureMeetingRooms(companyId: string) {
  for (const r of ROOM_SEED) {
    await prisma.meetingRoom.upsert({
      where: { key_companyId: { key: r.key, companyId } },
      update: {},
      create: { key: r.key, name: r.name, companyId },
    });
  }
}

/**
 * Automatic Check-in: booking BOOKED yang belum check-in manual dan sudah lewat
 * toleransi (mulai + 15 menit) TIDAK dilepas, melainkan ditandai AUTO_CHECKED_IN
 * agar jadwalnya tetap tercatat/tertrack. Dipanggil sebelum baca/booking, dan
 * juga oleh cron per-menit. `companyId` opsional → tanpa filter = semua company.
 */
export async function autoCheckinExpired(companyId?: string) {
  const threshold = new Date(Date.now() - GRACE_MS);
  await prisma.meetingBooking.updateMany({
    where: {
      status: "BOOKED",
      checkedInAt: null,
      startAt: { lt: threshold },
      ...(companyId ? { room: { companyId } } : {}),
    },
    data: { status: "AUTO_CHECKED_IN", checkedInAt: new Date() },
  });
}

/** Apakah pemesanan bentrok dgn booking aktif lain di ruang & rentang waktu. */
export async function hasOverlap(
  roomId: string,
  startAt: Date,
  endAt: Date,
  excludeId?: string
): Promise<boolean> {
  const clash = await prisma.meetingBooking.findFirst({
    where: {
      roomId,
      status: { in: ["BOOKED", "CHECKED_IN", "AUTO_CHECKED_IN"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(clash);
}

/** Rentang boleh check-in: 15 menit sebelum mulai s/d 15 menit setelah mulai. */
export function canCheckIn(startAt: Date, now = new Date()): boolean {
  const t = startAt.getTime();
  return now.getTime() >= t - GRACE_MS && now.getTime() <= t + GRACE_MS;
}

export type Recurrence = {
  freq: "WEEKLY" | "WEEKDAY" | "MONTHLY";
  weekdays?: number[]; // 0=Min..6=Sab (untuk WEEKLY)
  endMode: "date" | "count";
  untilDate?: string; // YYYY-MM-DD (mode date)
  count?: number; // jumlah pertemuan (mode count)
};

const MAX_OCCURRENCES = 100;
const HORIZON_DAYS = 220; // ~7 bulan pengaman

function addDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Hasilkan daftar tanggal (YYYY-MM-DD) untuk meeting berulang, mulai dari startDate. */
export function generateOccurrenceDates(
  startDate: string,
  rec: Recurrence
): string[] {
  const anchorDom = parseInt(startDate.slice(8, 10), 10);
  const until = rec.endMode === "date" ? rec.untilDate : undefined;
  const maxCount =
    rec.endMode === "count"
      ? Math.min(Math.max(1, rec.count ?? 1), MAX_OCCURRENCES)
      : MAX_OCCURRENCES;

  const dates: string[] = [];
  let cur = startDate;
  for (let i = 0; i < HORIZON_DAYS; i++) {
    if (dates.length >= maxCount) break;
    const wd = new Date(`${cur}T12:00:00Z`).getUTCDay();
    const dom = parseInt(cur.slice(8, 10), 10);
    let match = false;
    if (rec.freq === "WEEKDAY") match = wd >= 1 && wd <= 5;
    else if (rec.freq === "WEEKLY") match = (rec.weekdays ?? []).includes(wd);
    else if (rec.freq === "MONTHLY") match = dom === anchorDom;
    if (match) dates.push(cur);
    if (until && cur >= until) break;
    cur = addDay(cur);
  }
  return dates;
}
