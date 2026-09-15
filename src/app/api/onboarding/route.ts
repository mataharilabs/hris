import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { getOnboarding } from "@/lib/gamification";

export async function GET() {
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
    return ok(await getOnboarding(emp));
  } catch (e) {
    return handleApiError(e);
  }
}
