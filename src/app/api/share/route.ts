import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireHr } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

// Pastikan company punya shareToken (untuk link publik) & kembalikan.
export async function GET() {
  try {
    const user = await requireHr();
    let company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { shareToken: true },
    });
    if (!company?.shareToken) {
      company = await prisma.company.update({
        where: { id: user.companyId },
        data: { shareToken: randomUUID().replace(/-/g, "") },
        select: { shareToken: true },
      });
    }
    return ok({ token: company.shareToken });
  } catch (e) {
    return handleApiError(e);
  }
}
