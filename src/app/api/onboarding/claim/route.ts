import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { addPoint, getOnboarding, ONBOARDING_POINTS } from "@/lib/gamification";

export async function POST() {
  try {
    const user = await requireUser();
    const emp = await prisma.employee.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        birthDate: true,
        emergencyName: true,
        emergencyRelation: true,
        emergencyPhone: true,
        photoDataUrl: true,
        onboardingClaimedAt: true,
      },
    });
    if (!emp) return ok({ error: "Karyawan tidak ditemukan" }, 404);

    const status = await getOnboarding(emp);
    if (!status.claimable) {
      return ok({ error: "Reward belum bisa diklaim" }, 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: emp.id },
        data: { onboardingClaimedAt: new Date() },
      });
      await addPoint(
        tx,
        emp.id,
        "ONBOARDING",
        ONBOARDING_POINTS,
        "Reward Onboarding Quest selesai 🎉"
      );
    });

    return ok({ ok: true, points: ONBOARDING_POINTS });
  } catch (e) {
    return handleApiError(e);
  }
}
