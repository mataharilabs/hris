import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { addPoint, hasCheckedInToday, getCheckinStreak, CHECKIN_POINTS } from "@/lib/gamification";

// Status check-in hari ini — dipakai CheckinModal global
export async function GET() {
  try {
    const user = await requireUser();
    const [checkedIn, streak] = await Promise.all([
      hasCheckedInToday(user.id),
      getCheckinStreak(user.id),
    ]);
    return ok({ checkedIn, streak, name: user.name ?? "" });
  } catch (e) {
    return handleApiError(e);
  }
}

// Check-in harian (presensi) — sekali per hari WIB, +5 pts.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (await hasCheckedInToday(user.id)) {
      return ok({ error: "Kamu sudah check-in hari ini" }, 400);
    }
    const body = await req.json().catch(() => ({}));
    const mood = typeof body?.mood === "string" ? body.mood : null;
    const note = mood
      ? `Presensi harian · suasana hati: ${mood.toLowerCase()}`
      : "Presensi harian (daily clock-in)";
    await addPoint(prisma, user.id, "DAILY_CHECKIN", CHECKIN_POINTS, note);
    const streak = await getCheckinStreak(user.id);
    return ok({ ok: true, points: CHECKIN_POINTS, streak });
  } catch (e) {
    return handleApiError(e);
  }
}
