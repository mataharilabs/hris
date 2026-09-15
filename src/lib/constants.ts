// Label & metadata untuk HRIS (Bahasa Indonesia)

export const ROLE_LABELS: Record<string, string> = {
  HR_ADMIN: "HR Admin",
  HR_STAFF: "HR Staff",
  EMPLOYEE: "Karyawan",
};

export const GENDER_LABELS: Record<string, string> = {
  MALE: "Laki-laki",
  FEMALE: "Perempuan",
};

export const MARITAL_STATUS_LABELS: Record<string, string> = {
  SINGLE: "Belum Menikah",
  MARRIED: "Menikah",
  DIVORCED: "Cerai",
  WIDOWED: "Janda/Duda",
};

export const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  PERMANENT: "Tetap (PKWTT)",
  CONTRACT: "Kontrak (PKWT)",
  INTERNSHIP: "Magang",
  FREELANCE: "Freelance",
};

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: "Cuti Tahunan",
  SICK: "Cuti Sakit",
  SICK_CERTIFIED: "Cuti Sakit Dengan Surat",
  UNPAID: "Cuti Tanpa Gaji",
  OTHER: "Lainnya",
};

// Pilihan jenis cuti yang tampil di form pengajuan (hanya 3).
export const LEAVE_TYPE_OPTIONS: Record<string, string> = {
  ANNUAL: "Cuti Tahunan",
  SICK: "Cuti Sakit",
  SICK_CERTIFIED: "Cuti Sakit Dengan Surat",
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

export const REQUEST_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
};

export const REIMBURSEMENT_CATEGORIES = [
  "Transport",
  "Kesehatan",
  "Makan",
  "Komunikasi",
  "Perjalanan Dinas",
  "Pelatihan",
  "Lainnya",
];

// Navigasi berdasarkan role
export type NavRole = "HR_ADMIN" | "HR_STAFF" | "EMPLOYEE";

export const HR_ROLES: NavRole[] = ["HR_ADMIN", "HR_STAFF"];
export const ALL_ROLES: NavRole[] = ["HR_ADMIN", "HR_STAFF", "EMPLOYEE"];
