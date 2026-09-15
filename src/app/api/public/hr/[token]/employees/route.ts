import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api";
import type { Prisma } from "@prisma/client";

// Sensor sebagian karakter — data mentah TIDAK pernah dikirim ke publik.
function maskTail(v: string | null, keep: number): string | null {
  if (!v) return null;
  const s = v.replace(/\s+/g, "");
  if (s.length <= keep) return "•".repeat(Math.max(3, s.length));
  return "•".repeat(s.length - keep) + s.slice(-keep);
}
function maskEmail(v: string | null): string | null {
  if (!v) return null;
  const [u, d] = v.split("@");
  if (!d) return "•••";
  return `${u.slice(0, 2)}${"•".repeat(Math.max(3, u.length - 2))}@${d}`;
}
function maskAddress(v: string | null): string | null {
  if (!v) return null;
  return `${v.slice(0, 6)} •••`;
}

// Publik (tanpa login) — divalidasi lewat shareToken company.
// Kolom sensitif (NIK, NPWP, Alamat KTP, telepon, email) disensor sebagian.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const company = await prisma.company.findFirst({
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
    prisma.employee.findMany({ where, orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: { companyId: company.id },
      select: { departmentName: true, officeName: true },
    }),
  ]);

  const year = new Date().getFullYear();
  const usedRows = await prisma.leaveRequest.groupBy({
    by: ["employeeId"],
    where: {
      type: "ANNUAL",
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      employee: { companyId: company.id },
    },
    _sum: { days: true },
  });
  const usedByEmp = new Map(usedRows.map((r) => [r.employeeId, r._sum.days ?? 0]));

  const items = rows.map((e) => {
    const used = usedByEmp.get(e.id) ?? 0;
    return {
      id: e.id,
      name: e.name,
      email: maskEmail(e.email),
      phone: maskTail(e.phone, 4),
      departmentName: e.departmentName,
      officeName: e.officeName,
      employmentStatus: e.employmentStatus,
      gender: e.gender,
      maritalStatus: e.maritalStatus,
      birthDate: e.birthDate,
      addressKtp: maskAddress(e.addressKtp),
      nik: maskTail(e.nik, 4),
      npwp: maskTail(e.npwp, 3),
      joinDate: e.joinDate,
      leaveQuota: e.leaveQuota,
      leaveRemaining: Math.max(0, e.leaveQuota - used + e.leaveAdjustment),
    };
  });

  const uniq = (xs: (string | null)[]) =>
    Array.from(new Set(xs.filter((x): x is string => !!x))).sort();

  return ok({
    items,
    total: rows.length,
    filters: {
      departments: uniq(all.map((a) => a.departmentName)),
      offices: uniq(all.map((a) => a.officeName)),
    },
  });
}
