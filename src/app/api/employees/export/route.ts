import { prisma } from "@/lib/prisma";
import { requireHr } from "@/lib/session";
import { handleApiError } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { EMPLOYMENT_STATUS_LABELS, GENDER_LABELS } from "@/lib/constants";
import { ageFrom, tenureYears, formatDate } from "@/lib/utils";

export async function GET() {
  try {
    const user = await requireHr();
    const rows = await prisma.employee.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: "asc" },
    });

    const headers = [
      "Kode",
      "Nama",
      "Email",
      "Telepon",
      "Jabatan",
      "Level",
      "Departemen",
      "Lokasi",
      "Status",
      "Gender",
      "Tanggal Lahir",
      "Umur",
      "Tanggal Masuk",
      "Masa Kerja (thn)",
      "Gaji Bulanan",
      "Kuota Cuti",
    ];
    const data = rows.map((e) => [
      e.employeeCode ?? "",
      e.name,
      e.email,
      e.phone ?? "",
      e.jobTitle ?? "",
      e.level ?? "",
      e.departmentName ?? "",
      e.officeName ?? "",
      e.employmentStatus ? EMPLOYMENT_STATUS_LABELS[e.employmentStatus] : "",
      e.gender ? GENDER_LABELS[e.gender] : "",
      e.birthDate ? formatDate(e.birthDate) : "",
      ageFrom(e.birthDate) ?? "",
      e.joinDate ? formatDate(e.joinDate) : "",
      tenureYears(e.joinDate) ?? "",
      e.monthlySalary ?? "",
      e.leaveQuota,
    ]);

    const csv = toCsv(headers, data);
    const today = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="karyawan-${today}.csv"`,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
