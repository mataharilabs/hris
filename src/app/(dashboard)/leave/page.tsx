import { requireUser, isHr } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { annualLeaveBalance } from "@/lib/leave";
import { EmployeeLeavePage } from "@/components/leave/EmployeeLeavePage";
import { HrLeavePage } from "@/components/leave/HrLeavePage";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const user = await requireUser();
  const hr = isHr(user.role);
  const isAdmin = user.role === "HR_ADMIN";

  const emp = await prisma.employee.findUnique({
    where: { id: user.id },
    select: { leaveQuota: true, leaveAdjustment: true },
  });
  const balance = await annualLeaveBalance(
    user.id,
    emp?.leaveQuota ?? 0,
    emp?.leaveAdjustment ?? 0
  );

  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const myLeaves = await prisma.leaveRequest.findMany({
    where: { employeeId: user.id, startDate: { gte: yearStart, lt: yearEnd } },
    include: {
      substitute: { select: { name: true } },
      manager: { select: { name: true } },
    },
    orderBy: { startDate: "desc" },
  });

  if (!hr) {
    return (
      <EmployeeLeavePage
        initialLeaves={JSON.parse(JSON.stringify(myLeaves))}
        balance={balance}
        currentYear={year}
      />
    );
  }

  // HR — additional data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [pending, approvedAll, approvedTotal, onLeaveToday, monthlyAgg] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        status: "PENDING",
        employee: { companyId: user.companyId },
      },
      include: {
        employee: { select: { id: true, name: true } },
        substitute: { select: { name: true } },
        manager: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        employee: { companyId: user.companyId },
      },
      include: {
        employee: { select: { id: true, name: true } },
        substitute: { select: { name: true } },
        manager: { select: { name: true } },
      },
      orderBy: { startDate: "desc" },
      take: 8,
    }),
    prisma.leaveRequest.count({
      where: {
        status: "APPROVED",
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

  // Normalize employee name onto HR leave items
  const normPending = pending.map((l) => ({
    ...l,
    employeeName: l.employee.name,
    employeeId: l.employee.id,
  }));
  const normApproved = approvedAll.map((l) => ({
    ...l,
    employeeName: l.employee.name,
    employeeId: l.employee.id,
  }));

  const summary = {
    pendingCount: pending.length,
    onLeaveTodayCount: onLeaveToday.length,
    onLeaveTodayNames: onLeaveToday.map((l) => l.employee.name.split(" ")[0]),
    monthlyApprovedCount: monthlyAgg._count,
    monthlyTotalDays: monthlyAgg._sum.days ?? 0,
  };

  return (
    <HrLeavePage
      pending={JSON.parse(JSON.stringify(normPending))}
      approvedAll={JSON.parse(JSON.stringify(normApproved))}
      approvedTotal={approvedTotal}
      summary={summary}
      myLeaves={JSON.parse(JSON.stringify(myLeaves))}
      myBalance={balance}
      isAdmin={isAdmin}
      currentYear={year}
    />
  );
}
