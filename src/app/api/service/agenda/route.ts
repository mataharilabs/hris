import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";

const TZ = "Asia/Jakarta";
const TZ_OFFSET = "+07:00";

// --- helpers ---

function todayWib(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function wibDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

function wibDayStart(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00${TZ_OFFSET}`);
}

function wibTime(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function idFormat(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: TZ, ...opts }).format(d);
}

function formatDays(days: number): string {
  if (days === 0.5) return "½ hari";
  return `${Math.round(days)} hari`;
}

function formatLeaveRange(start: Date, end: Date): string {
  const startStr = wibDateStr(start);
  const endStr = wibDateStr(end);
  const startDay = idFormat(start, { day: "numeric" });
  const endDay = idFormat(end, { day: "numeric" });
  const [sY, sM] = startStr.split("-");
  const [eY, eM] = endStr.split("-");

  if (startStr === endStr) {
    return idFormat(start, { day: "numeric", month: "short", year: "numeric" });
  }
  if (sY === eY && sM === eM) {
    // 29–30 Des 2026
    return `${startDay}–${endDay} ${idFormat(start, { month: "short", year: "numeric" })}`;
  }
  if (sY === eY) {
    // 29 Des–2 Jan 2026
    return `${startDay} ${idFormat(start, { month: "short" })}–${endDay} ${idFormat(end, { month: "short", year: "numeric" })}`;
  }
  // 29 Des 2026–2 Jan 2027
  return (
    `${startDay} ${idFormat(start, { month: "short", year: "numeric" })}` +
    `–${endDay} ${idFormat(end, { month: "short", year: "numeric" })}`
  );
}

function daysUntil(start: Date, todayStr: string): number {
  const a = wibDayStart(todayStr);
  const b = wibDayStart(wibDateStr(start));
  return Math.round((b.getTime() - a.getTime()) / (86400 * 1000));
}

// --- types ---

type AgendaItem = {
  type: "leave_pending" | "leave_next" | "meeting_today" | "meeting_upcoming";
  title: string;
  detail: string;
  href: string;
};

// --- route ---

export async function GET(req: NextRequest) {
  const key = process.env.SERVICE_API_KEY ?? "";
  const auth = req.headers.get("authorization");
  if (!key || auth !== `Bearer ${key}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({
    where: { ssoUserId: userId, isActive: true },
    select: { id: true },
  });
  if (!employee) {
    return Response.json({ items: [] });
  }

  const today = todayWib();
  const todayStart = wibDayStart(today);
  const tomorrowStart = new Date(todayStart.getTime() + 86400 * 1000);

  const items: AgendaItem[] = [];

  // --- leave ---

  const [pendingLeaves, nextLeave] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { employeeId: employee.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: "APPROVED",
        startDate: { gte: tomorrowStart },
      },
      orderBy: { startDate: "asc" },
    }),
  ]);

  for (const leave of pendingLeaves) {
    const typeLabel = LEAVE_TYPE_LABELS[leave.type] ?? leave.type;
    const range = formatLeaveRange(leave.startDate, leave.endDate);
    items.push({
      type: "leave_pending",
      title: "Pengajuan cuti Anda",
      detail: `${typeLabel} · ${range} · ${formatDays(leave.days)}`,
      href: "/leave",
    });
  }

  if (nextLeave) {
    const typeLabel = LEAVE_TYPE_LABELS[nextLeave.type] ?? nextLeave.type;
    const titleDate = idFormat(nextLeave.startDate, {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const n = daysUntil(nextLeave.startDate, today);
    items.push({
      type: "leave_next",
      title: titleDate,
      detail: `${typeLabel} · ${formatDays(nextLeave.days)} · ${n} hari lagi`,
      href: "/leave",
    });
  }

  // --- meetings ---

  const bookings = await prisma.meetingBooking.findMany({
    where: {
      employeeId: employee.id,
      status: { in: ["BOOKED", "CHECKED_IN"] },
      startAt: { gte: todayStart },
    },
    orderBy: { startAt: "asc" },
    include: { room: { select: { name: true } } },
    take: 20,
  });

  // Deduplicate recurring series: keep earliest occurrence per seriesId
  const seenSeries = new Set<string>();
  for (const b of bookings) {
    if (b.seriesId) {
      if (seenSeries.has(b.seriesId)) continue;
      seenSeries.add(b.seriesId);
    }

    const isToday = b.startAt >= todayStart && b.startAt < tomorrowStart;

    if (isToday) {
      items.push({
        type: "meeting_today",
        title: b.title,
        detail: `${wibTime(b.startAt)}–${wibTime(b.endAt)} · ${b.room.name}`,
        href: "/meeting-rooms",
      });
    } else {
      const dateLabel = idFormat(b.startAt, {
        weekday: "long",
        day: "numeric",
        month: "short",
      });
      items.push({
        type: "meeting_upcoming",
        title: b.title,
        detail: `${dateLabel} · ${wibTime(b.startAt)}–${wibTime(b.endAt)} · ${b.room.name}`,
        href: "/meeting-rooms",
      });
    }
  }

  return Response.json({ items });
}
