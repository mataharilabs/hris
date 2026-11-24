"use client";

import { useState, useMemo, useRef } from "react";
import { Search, CalendarDays, ChevronRight } from "lucide-react";
import { LeaveBalanceCard } from "./LeaveBalanceCard";
import { LeaveStatusBadge } from "./LeaveStatusBadge";
import { LeaveDetailPanel, LeaveItem } from "./LeaveDetailPanel";
import { LeaveForm } from "@/components/ess/LeaveForm";
import { toast } from "@/components/ui/toaster";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";
import {
  formatLeaveDate,
  formatLeaveDuration,
  formatDate,
  initials,
  cn,
} from "@/lib/utils";

type Balance = {
  quota: number;
  approved: number;
  pending: number;
  remaining: number;
  adjustment: number;
};

type Props = {
  initialLeaves: LeaveItem[];
  balance: Balance;
  currentYear: number;
};

const STATUS_TABS = [
  { key: "ALL", label: "Semua" },
  { key: "PENDING", label: "Menunggu" },
  { key: "APPROVED", label: "Disetujui" },
  { key: "REJECTED", label: "Ditolak" },
] as const;

const YEARS = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

export function EmployeeLeavePage({ initialLeaves, balance, currentYear }: Props) {
  const leaveFormRef = useRef<HTMLDivElement>(null);

  const [leaves, setLeaves] = useState<LeaveItem[]>(initialLeaves);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [year, setYear] = useState(currentYear);
  const [searchQ, setSearchQ] = useState("");
  const [loadingYear, setLoadingYear] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function changeYear(y: number) {
    setYear(y);
    setLoadingYear(true);
    try {
      const res = await fetch(`/api/leave?scope=mine&year=${y}`);
      const data = await res.json();
      if (Array.isArray(data)) setLeaves(data);
    } catch {
      toast("Gagal memuat data cuti", "error");
    } finally {
      setLoadingYear(false);
    }
  }

  // Client-side filtering
  const filtered = useMemo(() => {
    return leaves.filter((l) => {
      if (statusTab !== "ALL" && l.status !== statusTab) return false;
      if (
        searchQ &&
        !l.reason?.toLowerCase().includes(searchQ.toLowerCase())
      )
        return false;
      return true;
    });
  }, [leaves, statusTab, searchQ]);

  // Counts per tab
  const counts = useMemo(() => {
    const c = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    leaves.forEach((l) => {
      if (l.status === "PENDING") c.PENDING++;
      else if (l.status === "APPROVED") c.APPROVED++;
      else if (l.status === "REJECTED") c.REJECTED++;
    });
    return c;
  }, [leaves]);

  // Next upcoming leave
  const nextLeave = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (
      leaves
        .filter(
          (l) =>
            new Date(l.startDate) >= today &&
            (l.status === "APPROVED" || l.status === "PENDING")
        )
        .sort(
          (a, b) =>
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        )[0] ?? null
    );
  }, [leaves]);

  const selectedLeave = selectedId ? leaves.find((l) => l.id === selectedId) ?? null : null;

  async function handleCancel(id: string) {
    if (!confirm("Batalkan pengajuan cuti ini? Tindakan ini tidak bisa diurungkan.")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/leave/${id}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Gagal membatalkan");
      setLeaves((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: "CANCELLED" } : l))
      );
      setSelectedId(null);
      toast("Pengajuan cuti dibatalkan", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setCancelling(false);
    }
  }

  function handleResubmit() {
    setSelectedId(null);
    setTimeout(() => {
      const btn = leaveFormRef.current?.querySelector("button");
      btn?.click();
    }, 150);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1F2A]">Cuti</h1>
          <p className="mt-1 text-sm text-[#6B7080]">Ajukan cuti dan pantau statusnya</p>
        </div>
        <div ref={leaveFormRef}>
          <LeaveForm />
        </div>
      </div>

      {/* Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <LeaveBalanceCard
          quota={balance.quota}
          approved={balance.approved}
          pending={balance.pending}
          remaining={balance.remaining}
        />

        {/* Cuti berikutnya */}
        <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Cuti berikutnya
          </p>
          {nextLeave ? (
            <div className="mt-2">
              <p className="font-semibold text-[#1B1F2A]">
                {formatLeaveDate(nextLeave.startDate, nextLeave.endDate)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <LeaveStatusBadge status={nextLeave.status} />
                <span className="text-xs text-slate-500">
                  {formatLeaveDuration(nextLeave.days, nextLeave.isHalfDay, nextLeave.halfDaySession)}
                </span>
                <span className="text-xs text-slate-400">
                  {LEAVE_TYPE_LABELS[nextLeave.type] ?? nextLeave.type}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
              <CalendarDays className="h-4 w-4" />
              Belum ada jadwal
            </p>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Status tabs */}
        <div className="flex overflow-x-auto rounded-xl bg-[#F7F5F7] p-1 gap-0.5 no-scrollbar">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusTab(t.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                statusTab === t.key
                  ? "bg-white text-[#1B1F2A] shadow-sm"
                  : "text-[#6B7080] hover:text-[#1B1F2A]"
              )}
            >
              {t.label}
              {t.key !== "ALL" && counts[t.key] > 0 && (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs font-semibold",
                    statusTab === t.key
                      ? "bg-[#FDE8EE] text-[#D6194B]"
                      : "bg-slate-200 text-slate-500"
                  )}
                >
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-1 gap-2">
          {/* Year select */}
          <select
            value={year}
            onChange={(e) => changeYear(Number(e.target.value))}
            className="rounded-xl border border-[#E6E2E6] bg-white px-3 py-2 text-sm text-[#1B1F2A] focus:border-[#D6194B] focus:outline-none"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Cari alasan..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="w-full rounded-xl border border-[#E6E2E6] bg-white py-2 pl-9 pr-3 text-sm text-[#1B1F2A] placeholder:text-slate-400 focus:border-[#D6194B] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Leave list */}
      {loadingYear ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
          Memuat...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-slate-200 bg-[#F7F5F7] px-6 py-12 text-center">
          {searchQ || statusTab !== "ALL" ? (
            <>
              <p className="font-medium text-slate-600">Tidak ada pengajuan yang cocok</p>
              <p className="mt-1 text-sm text-slate-400">Coba ubah filter atau kata pencarian.</p>
            </>
          ) : (
            <>
              <p className="font-medium text-slate-600">Belum ada pengajuan cuti di {year}</p>
              <p className="mt-1 text-sm text-slate-400">
                Klik tombol + Ajukan cuti untuk membuat pengajuan pertama Anda.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[18px] border border-[#E6E2E6] bg-white sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E6E2E6] bg-[#F7F5F7]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Jenis</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Alasan</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Konfirmasi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E2E6]">
                {filtered.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => setSelectedId(l.id)}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedId(l.id)}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-[#F7F5F7] focus-visible:outline-2 focus-visible:outline-[#D6194B] focus-visible:outline-offset-[-2px]"
                  >
                    <td className="px-4 py-3 font-medium text-[#1B1F2A]">
                      {LEAVE_TYPE_LABELS[l.type] ?? l.type}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[#1B1F2A]">{formatLeaveDate(l.startDate, l.endDate)}</p>
                      <p className="text-xs text-[#6B7080]">
                        {formatLeaveDuration(l.days, l.isHalfDay, l.halfDaySession)}
                      </p>
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      <p className="truncate text-[#6B7080]">{l.reason ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          title={`Pengganti: ${l.substitute?.name ?? "—"}`}
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                            l.substituteId
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-slate-100 text-slate-400"
                          )}
                        >
                          ✓
                        </span>
                        <span
                          title={`Manager: ${l.manager?.name ?? "—"}`}
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                            l.managerId
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-slate-100 text-slate-400"
                          )}
                        >
                          ✓
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <LeaveStatusBadge status={l.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {filtered.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className="flex w-full items-start gap-3 rounded-[18px] border border-[#E6E2E6] bg-white p-4 text-left shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FDE8EE] text-xs font-bold text-[#D6194B]">
                  {initials(LEAVE_TYPE_LABELS[l.type] ?? l.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#1B1F2A]">
                      {LEAVE_TYPE_LABELS[l.type] ?? l.type}
                    </span>
                    <LeaveStatusBadge status={l.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-[#6B7080]">
                    {formatLeaveDate(l.startDate, l.endDate)} ·{" "}
                    {formatLeaveDuration(l.days, l.isHalfDay, l.halfDaySession)}
                  </p>
                  {l.reason && (
                    <p className="mt-1 truncate text-xs text-slate-400">{l.reason}</p>
                  )}
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* Detail Panel */}
      {selectedLeave && (
        <LeaveDetailPanel
          leave={selectedLeave}
          isEmployee
          onClose={() => setSelectedId(null)}
          onCancel={cancelling ? undefined : handleCancel}
          onResubmit={handleResubmit}
        />
      )}
    </div>
  );
}
