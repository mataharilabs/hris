import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHr } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { parseCsv } from "@/lib/csv";

// Import CSV hanya memperbarui field milik-HRIS (gaji & kuota cuti),
// dicocokkan berdasarkan Email. Identitas/profil tetap dikelola di SSO.
export async function POST(req: NextRequest) {
  try {
    const user = await requireHr();
    const text = await req.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      return ok({ error: "File CSV kosong atau tidak valid" }, 400);
    }

    // Cari nama kolom yang cocok (fleksibel terhadap header ekspor).
    const emailKey = findKey(rows[0], ["email"]);
    const salaryKey = findKey(rows[0], ["gaji bulanan", "gaji", "salary"]);
    const quotaKey = findKey(rows[0], ["kuota cuti", "kuota", "leave quota"]);
    if (!emailKey) {
      return ok({ error: "Kolom 'Email' wajib ada di CSV" }, 400);
    }

    let updated = 0;
    const notFound: string[] = [];

    for (const r of rows) {
      const email = (r[emailKey] ?? "").trim().toLowerCase();
      if (!email) continue;
      const emp = await prisma.employee.findFirst({
        where: { email, companyId: user.companyId },
        select: { id: true },
      });
      if (!emp) {
        notFound.push(email);
        continue;
      }

      const data: { monthlySalary?: number | null; leaveQuota?: number } = {};
      if (salaryKey) {
        const val = parseIntSafe(r[salaryKey]);
        data.monthlySalary = val;
      }
      if (quotaKey) {
        const val = parseIntSafe(r[quotaKey]);
        if (val !== null) data.leaveQuota = val;
      }
      if (Object.keys(data).length === 0) continue;

      await prisma.employee.update({ where: { id: emp.id }, data });
      updated++;
    }

    return ok({ updated, notFound });
  } catch (e) {
    return handleApiError(e);
  }
}

function findKey(row: Record<string, string>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const hit = keys.find((k) => k.trim().toLowerCase() === c);
    if (hit) return hit;
  }
  return null;
}

function parseIntSafe(v: string | undefined): number | null {
  if (v === undefined) return null;
  const cleaned = v.replace(/[^\d-]/g, "");
  if (cleaned === "") return null;
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? null : n;
}
