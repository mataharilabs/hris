import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { annualLeaveBalance } from "@/lib/leave";

export async function GET() {
  try {
    const user = await requireUser();
    const emp = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { leaveQuota: true, leaveAdjustment: true },
    });
    const balance = await annualLeaveBalance(
      user.id,
      emp?.leaveQuota ?? 0,
      emp?.leaveAdjustment ?? 0
    );
    return ok(balance);
  } catch (e) {
    return handleApiError(e);
  }
}
