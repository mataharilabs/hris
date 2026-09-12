// Klien service ke SSO (Identity Provider) memakai SERVICE_API_KEY.
// Dipakai untuk menarik daftar karyawan (identitas + profil) dari SSO.

const SSO_URL = process.env.SSO_URL ?? "";
const KEY = process.env.SERVICE_API_KEY ?? "";

export type SsoEmployee = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  nickname: string | null;
  birthDate: string | null;
  gender: "MALE" | "FEMALE" | null;
  maritalStatus: string | null;
  nik: string | null;
  npwp: string | null;
  addressDomicile: string | null;
  personalEmail: string | null;
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
  employeeCode: string | null;
  jobTitle: string | null;
  level: string | null;
  employmentStatus:
    | "PERMANENT"
    | "CONTRACT"
    | "INTERNSHIP"
    | "FREELANCE"
    | null;
  joinDate: string | null;
  endDate: string | null;
  departmentName: string | null;
  officeName: string | null;
};

function ready(): boolean {
  return Boolean(SSO_URL && KEY);
}

async function ssoFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SSO_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

/** Daftar seluruh karyawan (identitas + profil) dari SSO untuk satu company. */
export async function listEmployees(opts: {
  companyId?: string;
}): Promise<SsoEmployee[]> {
  if (!ready()) return [];
  const qs = new URLSearchParams();
  if (opts.companyId) qs.set("companyId", opts.companyId);
  const res = await ssoFetch(`/api/service/employees?${qs}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.employees ?? [];
}

export type SsoAppUser = {
  id: string;
  name: string | null;
  email: string;
  role?: string;
};

/** Daftar staf HR (HR_ADMIN/HR_STAFF) dari SSO. Admin platform sudah dikecualikan endpoint. */
export async function listHrStaff(opts: {
  companyId?: string;
}): Promise<SsoAppUser[]> {
  if (!ready()) return [];
  const qs = new URLSearchParams({ applicationKey: "HRIS" });
  if (opts.companyId) qs.set("companyId", opts.companyId);
  const res = await ssoFetch(`/api/service/app-users?${qs}`);
  if (!res.ok) return [];
  const data = await res.json();
  const users: SsoAppUser[] = data.users ?? [];
  return users.filter((u) => u.role === "HR_ADMIN" || u.role === "HR_STAFF");
}
