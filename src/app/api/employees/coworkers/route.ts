import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { handleApiError, ok } from "@/lib/api";

// Daftar rekan kerja aktif (untuk picker kudos)
export async function GET() {
  try {
    const user = await requireUser();
    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, isActive: true, id: { not: user.id } },
      select: { id: true, name: true, jobTitle: true, departmentName: true, photoDataUrl: true },
      orderBy: { name: "asc" },
      take: 200,
    });
    return ok(employees);
  } catch (e) {
    return handleApiError(e);
  }
}
