"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Loader2, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  EMPLOYMENT_STATUS_LABELS,
  GENDER_LABELS,
  MARITAL_STATUS_LABELS,
} from "@/lib/constants";
import { formatDate, ageFrom, tenureYears } from "@/lib/utils";

type Item = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  departmentName: string | null;
  employmentStatus: string | null;
  addressKtp: string | null;
  gender: string | null;
  maritalStatus: string | null;
  birthDate: string | null;
  nik: string | null;
  npwp: string | null;
  joinDate: string | null;
};

type Filters = { departments: string[]; offices: string[]; levels: string[] };

export function EmployeeList() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    departments: [],
    offices: [],
    levels: [],
  });

  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("");
  const [office, setOffice] = useState("");
  const [status, setStatus] = useState("");
  const [gender, setGender] = useState("");
  const [level, setLevel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (department) params.set("department", department);
      if (office) params.set("office", office);
      if (status) params.set("status", status);
      if (gender) params.set("gender", gender);
      if (level) params.set("level", level);
      const res = await fetch(`/api/employees?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      if (data.filters) setFilters(data.filters);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [q, department, office, status, gender, level]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama, email, jabatan…"
              className="pl-9"
            />
          </div>
          <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">Semua Departemen</option>
            {filters.departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select value={office} onChange={(e) => setOffice(e.target.value)}>
            <option value="">Semua Lokasi</option>
            {filters.offices.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua Status</option>
            {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="flex-1"
            >
              <option value="">Gender</option>
              {Object.entries(GENDER_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            {filters.levels.length > 0 && (
              <Select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="flex-1"
              >
                <option value="">Level</option>
                {filters.levels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Tidak ada karyawan yang cocok.
          </div>
        ) : (
          <>
            <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
              {total} karyawan
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead>Departemen/Divisi</TableHead>
                  <TableHead>Alamat KTP</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Status Pernikahan</TableHead>
                  <TableHead>Tanggal Lahir</TableHead>
                  <TableHead>NIK</TableHead>
                  <TableHead>NPWP</TableHead>
                  <TableHead>Tanggal Bergabung</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link
                        href={`/employees/${e.id}`}
                        className="font-medium text-slate-800 hover:text-brand-700"
                      >
                        {e.name}
                      </Link>
                      <div className="text-xs text-slate-400">{e.email}</div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {e.phone ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.departmentName ?? "-"}
                      {e.employmentStatus && (
                        <div className="text-xs text-slate-400">
                          {EMPLOYMENT_STATUS_LABELS[e.employmentStatus]}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px] text-sm text-slate-600">
                      {e.addressKtp ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {e.gender ? GENDER_LABELS[e.gender] : "-"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {e.maritalStatus
                        ? MARITAL_STATUS_LABELS[e.maritalStatus]
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {e.birthDate ? formatDate(e.birthDate) : "-"}
                      {ageFrom(e.birthDate) != null && (
                        <div className="text-xs text-slate-400">
                          {ageFrom(e.birthDate)} tahun
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {e.nik ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {e.npwp ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {e.joinDate ? formatDate(e.joinDate) : "-"}
                      {tenureYears(e.joinDate) != null && (
                        <div className="text-xs text-slate-400">
                          {tenureYears(e.joinDate)} tahun
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/employees/${e.id}`}
                        className="inline-flex text-slate-400 hover:text-brand-700"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Card>
    </div>
  );
}
