import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isHr, AuthError } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { syncEmployeesFromSSO } from "@/lib/employee-sync";
import type { Prisma } from "@prisma/client";

// Daftar karyawan untuk halaman HR (filter + profil lengkap). HR-only.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!isHr(user.role)) throw new AuthError("Akses ditolak", 403);

    // Sync cermin dari SSO (termasuk NIK/NPWP/Alamat KTP).
    await syncEmployeesFromSSO(user.companyId, user.ssoCompanyId);

    const sp = req.nextUrl.searchParams;
    const where: Prisma.EmployeeWhereInput = { companyId: user.companyId };
    const q = sp.get("q");
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { employeeCode: { contains: q, mode: "insensitive" } },
        { jobTitle: { contains: q, mode: "insensitive" } },
      ];
    }
    const department = sp.get("department");
    const office = sp.get("office");
    const level = sp.get("level");
    const status = sp.get("status");
    const gender = sp.get("gender");
    if (department) where.departmentName = department;
    if (office) where.officeName = office;
    if (level) where.level = level;
    if (status)
      where.employmentStatus =
        status as Prisma.EmployeeWhereInput["employmentStatus"];
    if (gender) where.gender = gender as Prisma.EmployeeWhereInput["gender"];

    const [rows, all] = await Promise.all([
      prisma.employee.findMany({ where, orderBy: { name: "asc" } }),
      prisma.employee.findMany({
        where: { companyId: user.companyId },
        select: { departmentName: true, officeName: true, level: true },
      }),
    ]);

    // Sisa cuti tahunan per karyawan (kuota - ANNUAL PENDING/APPROVED tahun ini).
    const year = new Date().getFullYear();
    const usedRows = await prisma.leaveRequest.groupBy({
      by: ["employeeId"],
      where: {
        type: "ANNUAL",
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
        employee: { companyId: user.companyId },
      },
      _sum: { days: true },
    });
    const usedByEmp = new Map(usedRows.map((r) => [r.employeeId, r._sum.days ?? 0]));

    const items = rows.map((e) => {
      const used = usedByEmp.get(e.id) ?? 0;
      return {
        id: e.id,
        name: e.name,
        email: e.email,
        phone: e.phone,
        departmentName: e.departmentName,
        officeName: e.officeName,
        employmentStatus: e.employmentStatus,
        gender: e.gender,
        birthDate: e.birthDate,
        joinDate: e.joinDate,
        leaveQuota: e.leaveQuota,
        leaveRemaining: Math.max(0, e.leaveQuota - used + e.leaveAdjustment),
        addressKtp: e.addressKtp,
        maritalStatus: e.maritalStatus,
        nik: e.nik,
        npwp: e.npwp,
      };
    });

    const uniq = (xs: (string | null)[]) =>
      Array.from(new Set(xs.filter((x): x is string => !!x))).sort();

    return ok({
      items,
      total: items.length,
      filters: {
        departments: uniq(all.map((a) => a.departmentName)),
        offices: uniq(all.map((a) => a.officeName)),
        levels: uniq(all.map((a) => a.level)),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
