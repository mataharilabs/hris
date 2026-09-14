import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api";
import type { Prisma } from "@prisma/client";

// Publik (tanpa login) — divalidasi lewat shareToken company.
// Hanya kolom non-sensitif (tanpa NIK/NPWP/alamat/telepon/gaji).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const company = await prisma.company.findUnique({
    where: { shareToken: token },
    select: { id: true },
  });
  if (!company) return ok({ error: "Tidak ditemukan" }, 404);

  const sp = req.nextUrl.searchParams;
  const where: Prisma.EmployeeWhereInput = { companyId: company.id };
  const q = sp.get("q");
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { jobTitle: { contains: q, mode: "insensitive" } },
    ];
  }
  const department = sp.get("department");
  const office = sp.get("office");
  const status = sp.get("status");
  const gender = sp.get("gender");
  if (department) where.departmentName = department;
  if (office) where.officeName = office;
  if (status)
    where.employmentStatus =
      status as Prisma.EmployeeWhereInput["employmentStatus"];
  if (gender) where.gender = gender as Prisma.EmployeeWhereInput["gender"];

  const [rows, all] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        departmentName: true,
        officeName: true,
        employmentStatus: true,
        gender: true,
      },
    }),
    prisma.employee.findMany({
      where: { companyId: company.id },
      select: { departmentName: true, officeName: true },
    }),
  ]);

  const uniq = (xs: (string | null)[]) =>
    Array.from(new Set(xs.filter((x): x is string => !!x))).sort();

  return ok({
    items: rows,
    total: rows.length,
    filters: {
      departments: uniq(all.map((a) => a.departmentName)),
      offices: uniq(all.map((a) => a.officeName)),
    },
  });
}
