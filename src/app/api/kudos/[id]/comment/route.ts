import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

const schema = z.object({ message: z.string().trim().min(1).max(280) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { message } = schema.parse(await req.json());

    const kudos = await prisma.kudos.findUnique({ where: { id }, select: { id: true } });
    if (!kudos) return ok({ error: "Kudos tidak ditemukan" }, 404);

    const created = await prisma.kudosComment.create({
      data: { kudosId: id, employeeId: user.id, message },
    });
    return ok(created, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
