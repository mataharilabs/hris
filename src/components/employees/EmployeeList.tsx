"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Loader2, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { EMPLOYMENT_STATUS_LABELS, GENDER_LABELS } from "@/lib/constants";
import { formatCurrency, ageFrom } from "@/lib/utils";

type Item = {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  departmentName: string | null;
  employmentStatus: string | null;
  gender: string | null;
  birthDate: string | null;
  monthlySalary: number | null;
  leaveQuota: number;
  leaveRemaining: number;
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
                  <TableHead>Jabatan</TableHead>
                  <TableHead>Departemen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Umur</TableHead>
                  <TableHead>Saldo Cuti</TableHead>
                  <TableHead>Gaji</TableHead>
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
                    <TableCell className="text-sm">{e.jobTitle ?? "-"}</TableCell>
                    <TableCell className="text-sm">
                      {e.departmentName ?? "-"}
                    </TableCell>
                    <TableCell>
                      {e.employmentStatus ? (
                        <Badge className="border-slate-200 bg-slate-50 text-slate-600">
                          {EMPLOYMENT_STATUS_LABELS[e.employmentStatus]}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ageFrom(e.birthDate) ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      <span className="font-medium text-slate-800">
                        {e.leaveRemaining}
                      </span>
                      <span className="text-slate-400"> / {e.leaveQuota} hari</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatCurrency(e.monthlySalary)}
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
