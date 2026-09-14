import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeDemographics } from "@/lib/demographics";
import { Card, CardContent } from "@/components/ui/card";
import { DemographicsCharts } from "@/components/dashboard/DemographicsCharts";
import { PublicHeader } from "@/components/public/PublicHeader";

export const dynamic = "force-dynamic";

export default async function PublicDemografiPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const company = await prisma.company.findFirst({
    where: { shareToken: token },
    select: { id: true, name: true },
  });
  if (!company) notFound();

  const employees = await prisma.employee.findMany({
    where: { companyId: company.id },
  });
  const d = computeDemographics(employees);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-brand-50/30 to-white">
      <PublicHeader companyName={company.name} token={token} active="demografi" />
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">
          Demografi Karyawan
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Ringkasan demografi karyawan {company.name}.
        </p>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{d.total}</div>
                <div className="text-sm text-slate-500">Total Karyawan</div>
              </div>
            </CardContent>
          </Card>
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
      </main>
    </div>
  );
}
