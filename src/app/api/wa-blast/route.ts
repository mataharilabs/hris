import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { notifyGroup } from "@/lib/notify-client";

const schema = z.object({
  message: z.string().min(1, "Pesan tidak boleh kosong").max(1000),
  scheduledAt: z.string().nullable().optional(), // ISO string atau null = kirim sekarang
});

export async function GET(_req: NextRequest) {
  try {
    const user = await requireRole(["HR_ADMIN"]);
    const blasts = await prisma.waBlast.findMany({
      where: { companyId: user.companyId },
      include: { createdBy: { select: { name: true } } },
      orderBy: { scheduledAt: "desc" },
      take: 100,
    });
    return ok(blasts);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["HR_ADMIN"]);
    const data = schema.parse(await req.json());

    const now = new Date();
    const isNow = !data.scheduledAt || new Date(data.scheduledAt) <= now;

    if (isNow) {
      // Kirim langsung
      await notifyGroup(data.message);
      const blast = await prisma.waBlast.create({
        data: {
          companyId: user.companyId,
          message: data.message,
          scheduledAt: now,
          sentAt: now,
          status: "SENT",
          createdById: user.id,
        },
      });
      return ok(blast, 201);
    }

    // Jadwalkan
    const scheduledAt = new Date(data.scheduledAt!);
    const blast = await prisma.waBlast.create({
      data: {
        companyId: user.companyId,
        message: data.message,
        scheduledAt,
        status: "PENDING",
        createdById: user.id,
      },
    });
    return ok(blast, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
