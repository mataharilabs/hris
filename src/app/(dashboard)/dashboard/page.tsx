import { redirect } from "next/navigation";
import { Users, CalendarClock, Receipt } from "lucide-react";
import { requireUser, isHr } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { syncEmployeesFromSSO } from "@/lib/employee-sync";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  DemographicsCharts,
  type NamedCount,
} from "@/components/dashboard/DemographicsCharts";
import { EMPLOYMENT_STATUS_LABELS, GENDER_LABELS } from "@/lib/constants";
import { ageFrom, tenureYears } from "@/lib/utils";

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

function tally<T extends string>(
  items: (T | null | undefined)[],
  labels?: Record<string, string>
): NamedCount[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const key = it ?? "Tidak diisi";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({
      name: labels?.[name] ?? name,
      value,
    }))
    .sort((a, b) => b.value - a.value);
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

  const gender = tally(
    employees.map((e) => e.gender),
    GENDER_LABELS
  );
  const employmentStatus = tally(
    employees.map((e) => e.employmentStatus),
    EMPLOYMENT_STATUS_LABELS
  );
  const departments = tally(employees.map((e) => e.departmentName));

  const ageBand = (n: number | null) => {
    if (n == null) return "N/A";
    if (n < 25) return "< 25";
    if (n < 35) return "25–34";
    if (n < 45) return "35–44";
    return "45+";
  };
  const ageOrder = ["< 25", "25–34", "35–44", "45+", "N/A"];
  const ageBands = orderBands(
    tally(employees.map((e) => ageBand(ageFrom(e.birthDate)))),
    ageOrder
  );

  const tenureBand = (n: number | null) => {
    if (n == null) return "N/A";
    if (n < 1) return "< 1 thn";
    if (n < 3) return "1–3 thn";
    if (n < 5) return "3–5 thn";
    return "5+ thn";
  };
  const tenureOrder = ["< 1 thn", "1–3 thn", "3–5 thn", "5+ thn", "N/A"];
  const tenureBands = orderBands(
    tally(employees.map((e) => tenureBand(tenureYears(e.joinDate)))),
    tenureOrder
  );

  return (
    <div>
      <PageHeader
        title="Dashboard HR"
        description="Ringkasan & demografi karyawan."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat icon={Users} label="Total Karyawan" value={employees.length} />
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
        gender={gender}
        ageBands={ageBands}
        departments={departments}
        employmentStatus={employmentStatus}
        tenureBands={tenureBands}
      />
    </div>
  );
}

function orderBands(bands: NamedCount[], order: string[]): NamedCount[] {
  return bands
    .filter((b) => b.value > 0)
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
}
