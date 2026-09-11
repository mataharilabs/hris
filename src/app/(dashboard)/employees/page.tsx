import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, ChevronRight, Search } from "lucide-react";
import { requireUser, isHr } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { syncEmployeesFromSSO } from "@/lib/employee-sync";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { ImportButton } from "@/components/employees/ImportButton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { EMPLOYMENT_STATUS_LABELS, GENDER_LABELS } from "@/lib/constants";
import { formatCurrency, ageFrom } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  department?: string;
  office?: string;
  status?: string;
  gender?: string;
  level?: string;
}>;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  if (!isHr(user.role)) redirect("/ess");

  await syncEmployeesFromSSO(user.companyId, user.ssoCompanyId);

  const sp = await searchParams;
  const where: Prisma.EmployeeWhereInput = { companyId: user.companyId };
  if (sp.q) {
    where.OR = [
      { name: { contains: sp.q, mode: "insensitive" } },
      { email: { contains: sp.q, mode: "insensitive" } },
      { employeeCode: { contains: sp.q, mode: "insensitive" } },
      { jobTitle: { contains: sp.q, mode: "insensitive" } },
    ];
  }
  if (sp.department) where.departmentName = sp.department;
  if (sp.office) where.officeName = sp.office;
  if (sp.level) where.level = sp.level;
  if (sp.status)
    where.employmentStatus = sp.status as Prisma.EmployeeWhereInput["employmentStatus"];
  if (sp.gender)
    where.gender = sp.gender as Prisma.EmployeeWhereInput["gender"];

  const [rows, all] = await Promise.all([
    prisma.employee.findMany({ where, orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: { companyId: user.companyId },
      select: {
        departmentName: true,
        officeName: true,
        level: true,
      },
    }),
  ]);

  const uniq = (xs: (string | null)[]) =>
    Array.from(new Set(xs.filter((x): x is string => !!x))).sort();
  const departments = uniq(all.map((a) => a.departmentName));
  const offices = uniq(all.map((a) => a.officeName));
  const levels = uniq(all.map((a) => a.level));

  return (
    <div>
      <PageHeader
        title="Karyawan"
        description="Database karyawan (bersumber dari SSO). Gaji & kuota cuti dikelola di HRIS."
        action={
          <div className="flex items-center gap-2">
            <ImportButton />
            <a
              href="/api/employees/export"
              className={buttonVariants({ variant: "outline" })}
            >
              <Download className="h-4 w-4" />
              Export
            </a>
          </div>
        }
      />

      <Card className="mb-4 p-4">
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Cari nama, email, jabatan…"
              className="pl-9"
            />
          </div>
          <Select name="department" defaultValue={sp.department ?? ""}>
            <option value="">Semua Departemen</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select name="office" defaultValue={sp.office ?? ""}>
            <option value="">Semua Lokasi</option>
            {offices.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={sp.status ?? ""}>
            <option value="">Semua Status</option>
            {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Select name="gender" defaultValue={sp.gender ?? ""} className="flex-1">
              <option value="">Gender</option>
              {Object.entries(GENDER_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          {levels.length > 0 && (
            <Select name="level" defaultValue={sp.level ?? ""}>
              <option value="">Semua Level</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          )}
          <div className="sm:col-span-2 lg:col-span-6 flex gap-2">
            <button
              type="submit"
              className={buttonVariants({ size: "sm" })}
            >
              Terapkan Filter
            </button>
            <Link
              href="/employees"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Reset
            </Link>
            <span className="ml-auto self-center text-sm text-slate-400">
              {rows.length} karyawan
            </span>
          </div>
        </form>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Tidak ada karyawan yang cocok. Pastikan data karyawan sudah ada di
            SSO.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead>Departemen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Umur</TableHead>
                <TableHead>Gaji</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link
                      href={`/employees/${e.id}`}
                      className="font-medium text-slate-800 hover:text-brand-700"
                    >
                      {e.name}
                    </Link>
                    <div className="text-xs text-slate-400">{e.email}</div>
                  </TableCell>
                  <TableCell className="text-sm">{e.jobTitle ?? "-"}</TableCell>
                  <TableCell className="text-sm">
                    {e.departmentName ?? "-"}
                  </TableCell>
                  <TableCell>
                    {e.employmentStatus ? (
                      <Badge className="border-slate-200 bg-slate-50 text-slate-600">
                        {EMPLOYMENT_STATUS_LABELS[e.employmentStatus]}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {ageFrom(e.birthDate) ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatCurrency(e.monthlySalary)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/employees/${e.id}`}
                      className="inline-flex text-slate-400 hover:text-brand-700"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
