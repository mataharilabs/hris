import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

// Toggle suka pada sebuah kudos.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await prisma.kudosLike.findUnique({
      where: { kudosId_employeeId: { kudosId: id, employeeId: user.id } },
    });
    if (existing) {
      await prisma.kudosLike.delete({ where: { id: existing.id } });
      return ok({ liked: false });
    }
    await prisma.kudosLike.create({
      data: { kudosId: id, employeeId: user.id },
    });
    return ok({ liked: true });
  } catch (e) {
    return handleApiError(e);
  }
}
