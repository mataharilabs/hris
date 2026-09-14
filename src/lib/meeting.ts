import { prisma } from "@/lib/prisma";

export const GRACE_MS = 15 * 60 * 1000; // toleransi check-in 15 menit

const ROOM_SEED = [
  { key: "UTAMA", name: "Ruang Meeting Utama" },
  { key: "SERVER", name: "Ruang Meeting Server" },
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
 * Automatic Release: lepaskan booking BOOKED yang belum check-in dan sudah
 * lewat toleransi (mulai + 15 menit). Dipanggil sebelum baca/booking.
 */
export async function autoReleaseExpired(companyId: string) {
  const threshold = new Date(Date.now() - GRACE_MS);
  await prisma.meetingBooking.updateMany({
    where: {
      status: "BOOKED",
      checkedInAt: null,
      startAt: { lt: threshold },
      room: { companyId },
    },
    data: { status: "RELEASED" },
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
      status: { in: ["BOOKED", "CHECKED_IN"] },
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
