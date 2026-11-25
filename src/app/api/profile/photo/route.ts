import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { addPoint, PROFILE_UPDATED_POINTS } from "@/lib/gamification";

const schema = z.object({ dataUrl: z.string() });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { dataUrl } = schema.parse(await req.json());

    if (!dataUrl.startsWith("data:image/")) {
      return ok({ error: "Format gambar tidak valid" }, 400);
    }
    if (dataUrl.length > 400_000) {
      return ok({ error: "Ukuran gambar terlalu besar" }, 400);
    }

    await prisma.$transaction(async (tx) => {
      const before = await tx.employee.findUnique({
        where: { id: user.id },
        select: { photoDataUrl: true },
      });
      await tx.employee.update({
        where: { id: user.id },
        data: { photoDataUrl: dataUrl },
      });
      if (!before?.photoDataUrl) {
        await addPoint(tx, user.id, "PROFILE_UPDATED", PROFILE_UPDATED_POINTS, "Menambahkan foto profil");
      }
    });

    return ok({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
