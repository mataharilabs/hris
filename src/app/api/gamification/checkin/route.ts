import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { addPoint, hasCheckedInToday, CHECKIN_POINTS } from "@/lib/gamification";

// Check-in harian (presensi) — sekali per hari WIB, +5 pts.
export async function POST() {
  try {
    const user = await requireUser();
    if (await hasCheckedInToday(user.id)) {
      return ok({ error: "Kamu sudah check-in hari ini" }, 400);
    }
    await addPoint(
      prisma,
      user.id,
      "DAILY_CHECKIN",
      CHECKIN_POINTS,
      "Presensi harian (daily clock-in)"
    );
    return ok({ ok: true, points: CHECKIN_POINTS });
  } catch (e) {
    return handleApiError(e);
  }
}
