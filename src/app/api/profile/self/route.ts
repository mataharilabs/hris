import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

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

    const updated = await prisma.employee.update({
      where: { id: user.id },
      data: patch,
      select: {
        birthDate: true,
        emergencyName: true,
        emergencyRelation: true,
        emergencyPhone: true,
      },
    });
    return ok(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
