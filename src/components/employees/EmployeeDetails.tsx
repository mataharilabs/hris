"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SsoEmployee } from "@/lib/sso-client";
import {
  GENDER_LABELS,
  MARITAL_STATUS_LABELS,
  EMPLOYMENT_STATUS_LABELS,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 py-2 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-800">{value || "-"}</span>
    </div>
  );
}

// Panel "Details" yang bisa diperluas — menampilkan seluruh profil dari SSO.
export function EmployeeDetails({ full }: { full: SsoEmployee | null }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <div>
          <div className="text-base font-semibold text-slate-900">Details</div>
          <div className="text-xs text-slate-400">
            Seluruh data profil karyawan (dari SSO).
          </div>
        </div>
        {open ? (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-slate-400" />
        )}
      </button>

      {open && (
        <CardContent>
          {!full ? (
            <p className="text-sm text-slate-400">
              Data profil lengkap tidak tersedia (belum tersinkron dari SSO).
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Pribadi
                </div>
                <Row label="Nama" value={full.name} />
                <Row label="Nama Panggilan" value={full.nickname} />
                <Row
                  label="Gender"
                  value={full.gender ? GENDER_LABELS[full.gender] : null}
                />
                <Row
                  label="Status Kawin"
                  value={
                    full.maritalStatus
                      ? MARITAL_STATUS_LABELS[full.maritalStatus]
                      : null
                  }
                />
                <Row
                  label="Tanggal Lahir"
                  value={full.birthDate ? formatDate(full.birthDate) : null}
                />
                <Row label="NIK" value={full.nik} />
                <Row label="NPWP" value={full.npwp} />
                <Row label="Alamat KTP" value={full.addressKtp} />
                <Row label="Alamat Domisili" value={full.addressDomicile} />
                <Row label="Email Pribadi" value={full.personalEmail} />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Kepegawaian & Kontak Darurat
                </div>
                <Row label="Kode Karyawan" value={full.employeeCode} />
                <Row label="Jabatan" value={full.jobTitle} />
                <Row label="Level" value={full.level} />
                <Row label="Departemen" value={full.departmentName} />
                <Row label="Lokasi Kantor" value={full.officeName} />
                <Row
                  label="Status"
                  value={
                    full.employmentStatus
                      ? EMPLOYMENT_STATUS_LABELS[full.employmentStatus]
                      : null
                  }
                />
                <Row
                  label="Tanggal Masuk"
                  value={full.joinDate ? formatDate(full.joinDate) : null}
                />
                <Row
                  label="Tanggal Berakhir"
                  value={full.endDate ? formatDate(full.endDate) : null}
                />
                <Row label="Telepon/WA" value={full.phone} />
                <Row label="Kontak Darurat" value={full.emergencyName} />
                <Row label="Hubungan" value={full.emergencyRelation} />
                <Row label="Telepon Darurat" value={full.emergencyPhone} />
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
