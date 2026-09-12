import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { syncEmployeesFromSSO } from "@/lib/employee-sync";

// Daftar kandidat karyawan pengganti (semua karyawan selain diri sendiri yang
// punya kontak email/telepon untuk menerima kode OTP).
export async function GET() {
  try {
    const user = await requireUser();
    await syncEmployeesFromSSO(user.companyId, user.ssoCompanyId);

    const rows = await prisma.employee.findMany({
      where: {
        companyId: user.companyId,
        isActive: true,
        id: { not: user.id },
        OR: [{ email: { not: "" } }, { phone: { not: null } }],
      },
      select: { id: true, name: true, email: true, phone: true, jobTitle: true },
      orderBy: { name: "asc" },
    });

    const substitutes = rows.map((e) => ({
      id: e.id,
      name: e.name,
      jobTitle: e.jobTitle,
      hasEmail: Boolean(e.email),
      hasPhone: Boolean(e.phone),
    }));
    return ok(substitutes);
  } catch (e) {
    return handleApiError(e);
  }
}
