import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHr } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

const schema = z.object({
  monthlySalary: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().int().nonnegative().nullable()
    )
    .optional(),
  leaveQuota: z
    .preprocess((v) => (v === "" ? undefined : Number(v)), z.number().int().min(0))
    .optional(),
});

// Update field milik-HRIS saja (gaji & kuota cuti). Profil dikelola di SSO.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireHr();
    const { id } = await params;
    const data = schema.parse(await req.json());

    const emp = await prisma.employee.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true },
    });
    if (!emp) return ok({ error: "Karyawan tidak ditemukan" }, 404);

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...(data.monthlySalary !== undefined
          ? { monthlySalary: data.monthlySalary }
          : {}),
        ...(data.leaveQuota !== undefined ? { leaveQuota: data.leaveQuota } : {}),
      },
    });
    return ok(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
