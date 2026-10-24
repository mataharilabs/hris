import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { addPoint, PROFILE_UPDATED_POINTS } from "@/lib/gamification";

// Edit data diri sendiri di HRIS: tanggal lahir & kontak darurat.
const schema = z.object({
  birthDate: z.string().optional().nullable(),
  emergencyName: z.string().max(120).optional().nullable(),
  emergencyRelation: z.string().max(60).optional().nullable(),
  emergencyPhone: z.string().max(30).optional().nullable(),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const data = schema.parse(await req.json());

    // Baca data lama untuk deteksi field baru yang pertama kali diisi
    const before = await prisma.employee.findUnique({
      where: { id: user.id },
      select: {
        birthDate: true,
        emergencyName: true,
        emergencyRelation: true,
        emergencyPhone: true,
      },
    });

    const patch: Record<string, unknown> = {};
    if (data.birthDate !== undefined) {
      patch.birthDate = data.birthDate
        ? new Date(`${data.birthDate}T00:00:00+07:00`)
        : null;
    }
    if (data.emergencyName !== undefined)
      patch.emergencyName = data.emergencyName || null;
    if (data.emergencyRelation !== undefined)
      patch.emergencyRelation = data.emergencyRelation || null;
    if (data.emergencyPhone !== undefined)
      patch.emergencyPhone = data.emergencyPhone || null;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({
        where: { id: user.id },
        data: patch,
        select: {
          birthDate: true,
          emergencyName: true,
          emergencyRelation: true,
          emergencyPhone: true,
        },
      });

      // Beri poin hanya saat field tertentu diisi pertama kali (sebelumnya null)
      const newBirthDate = !before?.birthDate && result.birthDate;
      const emergencyBefore =
        before?.emergencyName && before?.emergencyRelation && before?.emergencyPhone;
      const emergencyAfter =
        result.emergencyName && result.emergencyRelation && result.emergencyPhone;
      const newEmergency = !emergencyBefore && emergencyAfter;

      if (newBirthDate) {
        await addPoint(tx, user.id, "PROFILE_UPDATED", PROFILE_UPDATED_POINTS, "Melengkapi tanggal lahir");
      }
      if (newEmergency) {
        await addPoint(tx, user.id, "PROFILE_UPDATED", PROFILE_UPDATED_POINTS, "Melengkapi kontak darurat");
      }

      return result;
    });

    return ok(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
