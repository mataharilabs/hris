import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  value: number | string | null | undefined,
  currency = "IDR"
): string {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(
  value: Date | string | null | undefined,
  opts?: Intl.DateTimeFormatOptions
): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...opts,
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  return formatDate(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Waktu relatif singkat Bahasa Indonesia: "baru saja", "5 mnt lalu", "2 jam lalu". */
export function timeAgo(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 45) return "baru saja";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd} hari lalu`;
  return formatDate(d);
}

/** Umur (tahun) dari tanggal lahir. */
export function ageFrom(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/** Format jumlah hari cuti: "½ hari (Pagi)", "½ hari (Siang)", atau "3 hari". */
export function formatLeaveDays(
  days: number,
  isHalfDay: boolean,
  halfDaySession?: string | null
): string {
  if (isHalfDay) {
    const sesi = halfDaySession === "AFTERNOON" ? "Siang" : "Pagi";
    return `½ hari (${sesi})`;
  }
  return `${days} hari`;
}

/** Hari kerja (Senin–Jumat) antara dua tanggal, inklusif. */
export function workdayCount(start: Date, end: Date): number {
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (b < a) return 0;
  let count = 0;
  const cur = new Date(a);
  while (cur <= b) {
    const d = cur.getDay();
    if (d !== 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Format rentang tanggal cuti ringkas (id-ID).
 * "29 Okt 2026" | "20–21 Nov 2026" | "30 Des 2026 – 2 Jan 2027"
 */
export function formatLeaveDate(
  start: Date | string,
  end: Date | string
): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  const isSameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  if (isSameDay) return fmt(s);
  const isSameMonthYear =
    s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  if (isSameMonthYear) {
    const startDay = new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
    }).format(s);
    return `${startDay}–${fmt(e)}`;
  }
  return `${fmt(s)} – ${fmt(e)}`;
}

/** Format durasi cuti: "½ hari (Pagi)", "3 hari kerja". */
export function formatLeaveDuration(
  days: number,
  isHalfDay: boolean,
  halfDaySession?: string | null
): string {
  if (isHalfDay) {
    const sesi = halfDaySession === "AFTERNOON" ? "Siang" : "Pagi";
    return `½ hari (${sesi})`;
  }
  return `${days} hari kerja`;
}

/** Masa kerja (tahun, desimal 1) dari tanggal masuk. */
export function tenureYears(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.round((ms / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10);
}
