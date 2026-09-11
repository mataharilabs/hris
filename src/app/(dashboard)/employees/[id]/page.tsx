import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireUser, isHr } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { annualLeaveBalance } from "@/lib/leave";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SalaryForm } from "@/components/employees/SalaryForm";
import {
  EMPLOYMENT_STATUS_LABELS,
  GENDER_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDate, ageFrom, tenureYears } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm text-slate-800">{value || "-"}</div>
    </div>
  );
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!isHr(user.role)) redirect("/ess");

  const { id } = await params;
  const e = await prisma.employee.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!e) notFound();

  const balance = await annualLeaveBalance(e.id, e.leaveQuota);
  const ssoUrl = process.env.SSO_URL ?? "https://sso.asiacommerce.net";

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/employees"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke daftar
      </Link>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
          {(e.name || "?").slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{e.name}</h1>
          <p className="text-sm text-slate-500">
            {e.jobTitle ?? "-"}
            {e.departmentName ? ` · ${e.departmentName}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Data Kepegawaian</CardTitle>
              <a
                href={`${ssoUrl}/users`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                Edit di SSO <ExternalLink className="h-3 w-3" />
              </a>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Kode Karyawan" value={e.employeeCode} />
              <Field label="Email" value={e.email} />
              <Field label="Telepon" value={e.phone} />
              <Field label="Jabatan" value={e.jobTitle} />
              <Field label="Level" value={e.level} />
              <Field label="Departemen" value={e.departmentName} />
              <Field label="Lokasi" value={e.officeName} />
              <Field
                label="Status"
                value={
                  e.employmentStatus
                    ? EMPLOYMENT_STATUS_LABELS[e.employmentStatus]
                    : null
                }
              />
              <Field
                label="Tanggal Masuk"
                value={e.joinDate ? formatDate(e.joinDate) : null}
              />
              <Field
                label="Masa Kerja"
                value={
                  tenureYears(e.joinDate) != null
                    ? `${tenureYears(e.joinDate)} tahun`
                    : null
                }
              />
              <Field
                label="Gender"
                value={e.gender ? GENDER_LABELS[e.gender] : null}
              />
              <Field
                label="Umur"
                value={ageFrom(e.birthDate) != null ? `${ageFrom(e.birthDate)} tahun` : null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saldo Cuti Tahunan</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-6">
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  {balance.remaining}
                </div>
                <div className="text-xs text-slate-400">Sisa (hari)</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-400">
                  {balance.used}
                </div>
                <div className="text-xs text-slate-400">Terpakai</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-400">
                  {balance.quota}
                </div>
                <div className="text-xs text-slate-400">Kuota</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Data HRIS</CardTitle>
              <p className="text-xs text-slate-400">
                Hanya dikelola di HRIS (tidak ada di SSO).
              </p>
            </CardHeader>
            <CardContent>
              <div className="mb-3 rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-400">Gaji saat ini</div>
                <div className="text-lg font-semibold text-slate-900">
                  {formatCurrency(e.monthlySalary)}
                </div>
              </div>
              <SalaryForm
                employeeId={e.id}
                initialSalary={e.monthlySalary}
                initialQuota={e.leaveQuota}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
