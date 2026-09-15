import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHr } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { usedAnnualLeave } from "@/lib/leave";

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
  // Sisa cuti yang diinginkan HR (opsional) → disimpan sebagai penyesuaian.
  remaining: z
    .preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().min(0))
    .optional(),
});

// Update field milik-HRIS (gaji, kuota cuti, sisa cuti). Profil dikelola di SSO.
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
      select: { id: true, leaveQuota: true },
    });
    if (!emp) return ok({ error: "Karyawan tidak ditemukan" }, 404);

    const patch: Record<string, unknown> = {};
    if (data.monthlySalary !== undefined) patch.monthlySalary = data.monthlySalary;
    if (data.leaveQuota !== undefined) patch.leaveQuota = data.leaveQuota;

    // Set sisa cuti manual → hitung adjustment = target - (quota - terpakai).
    if (data.remaining !== undefined) {
      const quota = data.leaveQuota ?? emp.leaveQuota;
      const used = await usedAnnualLeave(id);
      patch.leaveAdjustment = data.remaining - (quota - used);
    }

    const updated = await prisma.employee.update({ where: { id }, data: patch });
    return ok(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
