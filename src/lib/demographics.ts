import {
  GENDER_LABELS,
  MARITAL_STATUS_LABELS,
  EMPLOYMENT_STATUS_LABELS,
} from "@/lib/constants";
import { ageFrom, tenureYears } from "@/lib/utils";

export type NamedCount = { name: string; value: number };

type Emp = {
  gender: string | null;
  maritalStatus: string | null;
  officeName: string | null;
  employmentStatus: string | null;
  departmentName: string | null;
  birthDate: Date | string | null;
  joinDate: Date | string | null;
};

function tally(
  items: (string | null | undefined)[],
  labels?: Record<string, string>
): NamedCount[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const key = it ?? "Tidak diisi";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name: labels?.[name] ?? name, value }))
    .sort((a, b) => b.value - a.value);
}

function orderBands(bands: NamedCount[], order: string[]): NamedCount[] {
  return bands
    .filter((b) => b.value > 0)
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
}

const AGE_ORDER = ["< 25", "25–34", "35–44", "45+", "N/A"];
const TENURE_ORDER = ["< 1 thn", "1–3 thn", "3–5 thn", "5+ thn", "N/A"];

function ageBand(n: number | null) {
  if (n == null) return "N/A";
  if (n < 25) return "< 25";
  if (n < 35) return "25–34";
  if (n < 45) return "35–44";
  return "45+";
}
function tenureBand(n: number | null) {
  if (n == null) return "N/A";
  if (n < 1) return "< 1 thn";
  if (n < 3) return "1–3 thn";
  if (n < 5) return "3–5 thn";
  return "5+ thn";
}

/** Hitung seluruh demografi karyawan dari daftar. */
export function computeDemographics(emps: Emp[]) {
  return {
    total: emps.length,
    gender: tally(emps.map((e) => e.gender), GENDER_LABELS),
    maritalStatus: tally(emps.map((e) => e.maritalStatus), MARITAL_STATUS_LABELS),
    offices: tally(emps.map((e) => e.officeName)),
    employmentStatus: tally(
      emps.map((e) => e.employmentStatus),
      EMPLOYMENT_STATUS_LABELS
    ),
    departments: tally(emps.map((e) => e.departmentName)),
    ageBands: orderBands(
      tally(emps.map((e) => ageBand(ageFrom(e.birthDate)))),
      AGE_ORDER
    ),
    tenureBands: orderBands(
      tally(emps.map((e) => tenureBand(tenureYears(e.joinDate)))),
      TENURE_ORDER
    ),
  };
}
