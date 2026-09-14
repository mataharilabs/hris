import { redirect } from "next/navigation";
import { Users, CalendarClock, Receipt } from "lucide-react";
import { requireUser, isHr } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { syncEmployeesFromSSO } from "@/lib/employee-sync";
import { computeDemographics } from "@/lib/demographics";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DemographicsCharts } from "@/components/dashboard/DemographicsCharts";
import { ShareButton } from "@/components/dashboard/ShareButton";

export const dynamic = "force-dynamic";

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-sm text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  if (!isHr(user.role)) redirect("/ess");

  await syncEmployeesFromSSO(user.companyId, user.ssoCompanyId);

  const [employees, pendingLeave, pendingReimb] = await Promise.all([
    prisma.employee.findMany({ where: { companyId: user.companyId } }),
    prisma.leaveRequest.count({
      where: { status: "PENDING", employee: { companyId: user.companyId } },
    }),
    prisma.reimbursementRequest.count({
      where: { status: "PENDING", employee: { companyId: user.companyId } },
    }),
  ]);

  const d = computeDemographics(employees);

  return (
    <div>
      <PageHeader
        title="Dashboard HR"
        description="Ringkasan & demografi karyawan."
        action={<ShareButton />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat icon={Users} label="Total Karyawan" value={d.total} />
        <Stat
          icon={CalendarClock}
          label="Cuti menunggu persetujuan"
          value={pendingLeave}
        />
        <Stat
          icon={Receipt}
          label="Reimbursement menunggu"
          value={pendingReimb}
        />
      </div>

      <DemographicsCharts
        gender={d.gender}
        maritalStatus={d.maritalStatus}
        offices={d.offices}
        ageBands={d.ageBands}
        departments={d.departments}
        employmentStatus={d.employmentStatus}
        tenureBands={d.tenureBands}
      />
    </div>
  );
}
