import { prisma } from "@/lib/prisma";

/**
 * Cuti tahunan (ANNUAL) yang memotong kuota tahun berjalan.
 * Termasuk yang MENUNGGU (PENDING) & DISETUJUI (APPROVED) — pengajuan
 * langsung "memesan" kuota; hanya yang DITOLAK yang mengembalikan kuota.
 */
export async function usedAnnualLeave(
  employeeId: string,
  year = new Date().getFullYear()
): Promise<number> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const rows = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      type: "ANNUAL",
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { gte: start, lt: end },
    },
    select: { days: true },
  });
  return rows.reduce((sum, r) => sum + r.days, 0);
}

/** Sisa saldo cuti tahunan (dengan penyesuaian manual HR). */
export async function annualLeaveBalance(
  employeeId: string,
  quota: number,
  adjustment = 0
): Promise<{ quota: number; used: number; remaining: number; adjustment: number }> {
  const used = await usedAnnualLeave(employeeId);
  return {
    quota,
    used,
    adjustment,
    remaining: Math.max(0, quota - used + adjustment),
  };
}

/** Jumlah hari (inklusif) antara dua tanggal. */
export function dayCount(start: Date, end: Date): number {
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
}
