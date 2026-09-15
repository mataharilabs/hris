import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

// GET: kudos yang diterima user (terbaru dulu) — untuk sambutan confetti.
export async function GET() {
  try {
    const user = await requireUser();
    const rows = await prisma.kudos.findMany({
      where: { recipientId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { sender: { select: { name: true } } },
    });
    return ok(
      rows.map((k) => ({
        id: k.id,
        message: k.message,
        createdAt: k.createdAt.toISOString(),
        senderName: k.sender?.name ?? "Rekan",
      }))
    );
  } catch (e) {
    return handleApiError(e);
  }
}
