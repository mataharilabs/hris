import { prisma } from "@/lib/prisma";
import { requireHr } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

// GET — ringkasan statistik cuti untuk HR.
export async function GET() {
  try {
    const user = await requireHr();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [pendingCount, onLeaveToday, monthlyApproved] = await Promise.all([
      prisma.leaveRequest.count({
        where: {
          status: "PENDING",
          employee: { companyId: user.companyId },
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          startDate: { lte: today },
          endDate: { gte: today },
          employee: { companyId: user.companyId },
        },
        include: { employee: { select: { name: true } } },
      }),
      prisma.leaveRequest.aggregate({
        where: {
          status: "APPROVED",
          startDate: { gte: monthStart, lt: monthEnd },
          employee: { companyId: user.companyId },
        },
        _sum: { days: true },
        _count: true,
      }),
    ]);

    return ok({
      pendingCount,
      onLeaveTodayCount: onLeaveToday.length,
      onLeaveTodayNames: onLeaveToday.map((l) =>
        l.employee.name.split(" ")[0]
      ),
      monthlyApprovedCount: monthlyApproved._count,
      monthlyTotalDays: monthlyApproved._sum.days ?? 0,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
