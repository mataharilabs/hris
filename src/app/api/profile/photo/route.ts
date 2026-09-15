import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

// Simpan foto profil sebagai data URL (sudah diperkecil di klien).
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

    await prisma.employee.update({
      where: { id: user.id },
      data: { photoDataUrl: dataUrl },
    });
    return ok({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
