"use client";

import { useState, useRef } from "react";
import {
  Search,
  Trash2,
  Users,
  Clock,
  CalendarDays,
  Loader2,
} from "lucide-react";
import { LeaveBalanceCard } from "./LeaveBalanceCard";
import { LeaveStatusBadge } from "./LeaveStatusBadge";
import { LeaveDetailPanel, LeaveItem } from "./LeaveDetailPanel";
import { HrPendingCard } from "./HrPendingCard";
import { HrRejectDialog } from "./HrRejectDialog";
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

type HrLeaveItem = LeaveItem & { employeeName: string; employeeId: string };

type Balance = {
  quota: number;
  approved: number;
  pending: number;
  remaining: number;
  adjustment: number;
};

type Summary = {
  pendingCount: number;
  onLeaveTodayCount: number;
  onLeaveTodayNames: string[];
  monthlyApprovedCount: number;
  monthlyTotalDays: number;
};

type Props = {
  pending: HrLeaveItem[];
  approvedAll: HrLeaveItem[];
  approvedTotal: number;
  summary: Summary;
  myLeaves: LeaveItem[];
  myBalance: Balance;
  isAdmin: boolean;
  currentYear: number;
};

const MONTHS = [
  "", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agt", "Sep", "Okt", "Nov", "Des",
];

const PAGE_SIZE = 8;

export function HrLeavePage({
  pending: initialPending,
  approvedAll: initialApproved,
  approvedTotal: initialApprovedTotal,
  summary: initialSummary,
  myLeaves: initialMyLeaves,
  myBalance,
  isAdmin,
  currentYear,
}: Props) {
  const leaveFormRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<"kelola" | "saya">("kelola");
  const [pending, setPending] = useState<HrLeaveItem[]>(initialPending);
  const [allLeaves, setAllLeaves] = useState<HrLeaveItem[]>(initialApproved);
  const [allTotal, setAllTotal] = useState(initialApprovedTotal);
  const [allPage, setAllPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; name: string } | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [undoBar, setUndoBar] = useState<{ id: string; undo: () => void } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters for all-employees section
  const [filterQ, setFilterQ] = useState("");
  const [filterMonth, setFilterMonth] = useState(0);
  const [filterType, setFilterType] = useState("");
  const [filterDirty, setFilterDirty] = useState(false);
  const [filtering, setFiltering] = useState(false);

  // "Cuti saya" state
  const [myLeaves, setMyLeaves] = useState<LeaveItem[]>(initialMyLeaves);
  const [selectedMyId, setSelectedMyId] = useState<string | null>(null);
  const [cancellingMyId, setCancellingMyId] = useState<string | null>(null);

  const selectedMyLeave = selectedMyId
    ? myLeaves.find((l) => l.id === selectedMyId) ?? null
    : null;

  // --- Kelola karyawan actions ---

  async function handleApprove(id: string) {
    setApprovingId(id);
    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Gagal menyetujui");
      setPending((prev) => prev.filter((l) => l.id !== id));
      toast("Pengajuan cuti disetujui", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setApprovingId(null);
    }
  }

  function handleRejectDone() {
    if (!rejectDialog) return;
    const id = rejectDialog.id;
    setRejectDialog(null);
    setPending((prev) => prev.filter((l) => l.id !== id));
    toast("Pengajuan cuti ditolak", "success");
  }

  function handleDeleteClick(id: string) {
    // Optimistic removal
    setDeletedIds((prev) => new Set(prev).add(id));
    setExpandedId(null);

    let cancelled = false;
    function undo() {
      cancelled = true;
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setUndoBar(null);
      if (undoTimer.current) clearTimeout(undoTimer.current);
    }

    setUndoBar({ id, undo });
    undoTimer.current = setTimeout(async () => {
      setUndoBar(null);
      if (cancelled) return;
      try {
        const res = await fetch(`/api/leave/${id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) throw new Error(data.error ?? "Gagal menghapus");
        setAllLeaves((prev) => prev.filter((l) => l.id !== id));
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } catch (e) {
        // Restore on error
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast((e as Error).message, "error");
      }
    }, 5000);
  }

  async function fetchFiltered(q: string, month: number, type: string, page: number, append = false) {
    setFiltering(true);
    try {
      const sp = new URLSearchParams({ scope: "all", page: String(page) });
      if (q) sp.set("q", q);
      if (month) sp.set("month", String(month));
      if (type) sp.set("type", type);
      const res = await fetch(`/api/leave?${sp}`);
      const data = await res.json();
      const rows = (data.rows ?? []) as HrLeaveItem[];
      if (append) {
        setAllLeaves((prev) => [
          ...prev,
          ...rows.filter((r) => !prev.some((p) => p.id === r.id)),
        ]);
      } else {
        setAllLeaves(rows);
      }
      setAllTotal(data.total ?? 0);
      setAllPage(page);
    } catch {
      toast("Gagal memuat data", "error");
    } finally {
      setFiltering(false);
    }
  }

  async function applyFilters(q: string, month: number, type: string) {
    setFilterQ(q);
    setFilterMonth(month);
    setFilterType(type);
    setFilterDirty(true);
    await fetchFiltered(q, month, type, 1);
  }

  async function loadMore() {
    setLoadingMore(true);
    await fetchFiltered(filterQ, filterMonth, filterType, allPage + 1, true);
    setLoadingMore(false);
  }

  // "Cuti saya" cancel
  async function handleCancelMine(id: string) {
    if (!confirm("Batalkan pengajuan cuti ini?")) return;
    setCancellingMyId(id);
    try {
      const res = await fetch(`/api/leave/${id}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Gagal membatalkan");
      setMyLeaves((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: "CANCELLED" } : l))
      );
      setSelectedMyId(null);
      toast("Pengajuan cuti dibatalkan", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setCancellingMyId(null);
    }
  }

  function triggerLeaveForm() {
    setSelectedMyId(null);
    setTimeout(() => {
      const btn = leaveFormRef.current?.querySelector("button");
      btn?.click();
    }, 150);
  }

  const visibleAll = allLeaves.filter((l) => !deletedIds.has(l.id));
  const shownCount = visibleAll.length;
  const remaining = allTotal - shownCount;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1F2A]">Cuti</h1>
          <p className="mt-1 text-sm text-[#6B7080]">Kelola cuti karyawan</p>
        </div>
        <div ref={leaveFormRef}>
          <LeaveForm />
        </div>
      </div>

      {/* Tab switcher */}
      <div className="mb-6 flex gap-1 rounded-xl border border-[#E6E2E6] bg-[#F7F5F7] p-1 w-fit">
        <button
          onClick={() => setActiveTab("kelola")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "kelola"
              ? "bg-white text-[#1B1F2A] shadow-sm"
              : "text-[#6B7080] hover:text-[#1B1F2A]"
          )}
        >
          Kelola karyawan
          {pending.length > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#D6194B] px-1 text-xs font-semibold text-white">
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("saya")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "saya"
              ? "bg-white text-[#1B1F2A] shadow-sm"
              : "text-[#6B7080] hover:text-[#1B1F2A]"
          )}
        >
          Cuti saya
        </button>
      </div>

      {/* ───── Tab: Kelola karyawan ───── */}
      {activeTab === "kelola" && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div
              className={cn(
                "rounded-[18px] border p-5 shadow-sm",
                initialSummary.pendingCount > 0
                  ? "border-amber-200 bg-amber-50"
                  : "border-slate-200 bg-white"
              )}
            >
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Clock className="h-4 w-4" />
                Menunggu persetujuan
              </div>
              <p className={cn("mt-2 text-3xl font-bold", initialSummary.pendingCount > 0 ? "text-amber-700" : "text-[#1B1F2A]")}>
                {pending.length}
              </p>
              {pending.length > 0 && (
                <p className="mt-1 text-xs text-amber-600">Perlu keputusan Anda</p>
              )}
            </div>

            <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Users className="h-4 w-4" />
                Sedang cuti hari ini
              </div>
              <p className="mt-2 text-3xl font-bold text-[#1B1F2A]">
                {initialSummary.onLeaveTodayCount}
              </p>
              {initialSummary.onLeaveTodayNames.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  {initialSummary.onLeaveTodayNames.slice(0, 3).join(", ")}
                  {initialSummary.onLeaveTodayNames.length > 3 &&
                    ` +${initialSummary.onLeaveTodayNames.length - 3}`}
                </p>
              )}
            </div>

            <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <CalendarDays className="h-4 w-4" />
                Total cuti bulan ini
              </div>
              <p className="mt-2 text-3xl font-bold text-[#1B1F2A]">
                {initialSummary.monthlyTotalDays}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {initialSummary.monthlyApprovedCount} pengajuan disetujui
              </p>
            </div>
          </div>

          {/* Section: Menunggu persetujuan */}
          <div>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-[#1B1F2A]">
                Menunggu Persetujuan
              </h2>
              <p className="text-sm text-[#6B7080]">
                Sudah dikonfirmasi pengganti dan manager. Tinggal setujui atau tolak.
              </p>
            </div>

            {pending.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-slate-200 bg-[#F7F5F7] px-6 py-10 text-center">
                <p className="font-medium text-slate-500">Semua sudah ditangani</p>
                <p className="mt-1 text-sm text-slate-400">Tidak ada pengajuan yang perlu ditinjau.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((l) => (
                  <HrPendingCard
                    key={l.id}
                    leave={l}
                    approving={approvingId === l.id}
                    onApprove={() => handleApprove(l.id)}
                    onReject={() => setRejectDialog({ id: l.id, name: l.employeeName })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Section: Pengajuan semua karyawan */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[#1B1F2A]">
                Pengajuan Semua Karyawan
              </h2>
              <span className="text-xs text-slate-400">
                {allTotal} pengajuan disetujui
              </span>
            </div>

            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Cari nama atau alasan..."
                  defaultValue={filterQ}
                  onChange={(e) => applyFilters(e.target.value, filterMonth, filterType)}
                  className="w-full rounded-xl border border-[#E6E2E6] bg-white py-2 pl-9 pr-3 text-sm focus:border-[#D6194B] focus:outline-none"
                />
              </div>
              <select
                value={filterMonth}
                onChange={(e) => applyFilters(filterQ, Number(e.target.value), filterType)}
                className="rounded-xl border border-[#E6E2E6] bg-white px-3 py-2 text-sm focus:border-[#D6194B] focus:outline-none"
              >
                <option value={0}>Semua bulan</option>
                {MONTHS.slice(1).map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={filterType}
                onChange={(e) => applyFilters(filterQ, filterMonth, e.target.value)}
                className="rounded-xl border border-[#E6E2E6] bg-white px-3 py-2 text-sm focus:border-[#D6194B] focus:outline-none"
              >
                <option value="">Semua jenis</option>
                {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {filtering ? (
              <div className="flex h-32 items-center justify-center text-sm text-slate-400">
                Memuat...
              </div>
            ) : visibleAll.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-slate-200 bg-[#F7F5F7] px-6 py-10 text-center">
                <p className="font-medium text-slate-500">Belum ada cuti yang disetujui</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-[18px] border border-[#E6E2E6] bg-white lg:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E6E2E6] bg-[#F7F5F7]">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Karyawan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Jenis</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Alasan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Pengganti / Manager</th>
                        {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E2E6]">
                      {visibleAll.map((l) => (
                        <>
                          <tr
                            key={l.id}
                            onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                            className="cursor-pointer hover:bg-[#F7F5F7]"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FDE8EE] text-[10px] font-bold text-[#D6194B]">
                                  {initials(l.employeeName)}
                                </div>
                                <span className="font-medium text-[#1B1F2A]">{l.employeeName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[#6B7080]">
                              {LEAVE_TYPE_LABELS[l.type] ?? l.type}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-[#1B1F2A]">{formatLeaveDate(l.startDate, l.endDate)}</p>
                              <p className="text-xs text-[#6B7080]">
                                {formatLeaveDuration(l.days, l.isHalfDay, l.halfDaySession)}
                              </p>
                            </td>
                            <td className="max-w-[180px] px-4 py-3">
                              <p className="truncate text-[#6B7080]">{l.reason ?? "—"}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs text-slate-500">{l.substitute?.name ?? "—"}</p>
                              <p className="text-xs text-slate-500">{l.manager?.name ?? "—"}</p>
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(l.id);
                                  }}
                                  title="Hapus"
                                  className="inline-flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                          {expandedId === l.id && (
                            <tr key={`${l.id}-exp`} className="bg-[#F7F5F7]">
                              <td colSpan={isAdmin ? 6 : 5} className="px-4 py-3">
                                <div className="flex flex-wrap gap-6 text-sm">
                                  {l.reason && (
                                    <div>
                                      <p className="text-xs font-medium text-slate-400">Alasan lengkap</p>
                                      <p className="mt-0.5 text-slate-700">{l.reason}</p>
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-xs font-medium text-slate-400">Tgl pengajuan</p>
                                    <p className="mt-0.5 text-slate-700">{formatDate(l.createdAt)}</p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="flex flex-col gap-3 lg:hidden">
                  {visibleAll.map((l) => (
                    <div
                      key={l.id}
                      className="rounded-[18px] border border-[#E6E2E6] bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FDE8EE] text-xs font-bold text-[#D6194B]">
                            {initials(l.employeeName)}
                          </div>
                          <div>
                            <p className="font-semibold text-[#1B1F2A]">{l.employeeName}</p>
                            <p className="text-xs text-[#6B7080]">
                              {LEAVE_TYPE_LABELS[l.type] ?? l.type}
                            </p>
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteClick(l.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="mt-3 text-sm text-[#6B7080]">
                        <p>{formatLeaveDate(l.startDate, l.endDate)} · {formatLeaveDuration(l.days, l.isHalfDay, l.halfDaySession)}</p>
                        {l.reason && <p className="mt-1 truncate">{l.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load more */}
                {remaining > 0 && (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#E6E2E6] bg-white py-3 text-sm font-medium text-[#6B7080] hover:bg-[#F7F5F7] disabled:opacity-50"
                  >
                    {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                    Tampilkan {Math.min(PAGE_SIZE, remaining)} lagi ({remaining} tersisa)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ───── Tab: Cuti saya ───── */}
      {activeTab === "saya" && (
        <div className="space-y-6">
          {/* Balance card */}
          <div className="max-w-md">
            <LeaveBalanceCard
              quota={myBalance.quota}
              approved={myBalance.approved}
              pending={myBalance.pending}
              remaining={myBalance.remaining}
            />
          </div>

          {/* Personal leave list */}
          <div>
            <h2 className="mb-3 text-base font-semibold text-[#1B1F2A]">Pengajuan saya</h2>
            {myLeaves.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-slate-200 bg-[#F7F5F7] px-6 py-10 text-center">
                <p className="font-medium text-slate-500">Belum ada pengajuan cuti</p>
                <p className="mt-1 text-sm text-slate-400">
                  Gunakan tombol + Ajukan cuti untuk membuat pengajuan.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[18px] border border-[#E6E2E6] bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E6E2E6] bg-[#F7F5F7]">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Jenis</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Alasan</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E2E6]">
                    {myLeaves.map((l) => (
                      <tr
                        key={l.id}
                        onClick={() => setSelectedMyId(l.id)}
                        onKeyDown={(e) => e.key === "Enter" && setSelectedMyId(l.id)}
                        tabIndex={0}
                        className="cursor-pointer hover:bg-[#F7F5F7]"
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
                          <LeaveStatusBadge status={l.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HR Reject dialog */}
      {rejectDialog && (
        <HrRejectDialog
          leaveId={rejectDialog.id}
          employeeName={rejectDialog.name}
          onClose={() => setRejectDialog(null)}
          onDone={handleRejectDone}
        />
      )}

      {/* Detail panel — Cuti saya */}
      {selectedMyLeave && (
        <LeaveDetailPanel
          leave={selectedMyLeave}
          isEmployee
          onClose={() => setSelectedMyId(null)}
          onCancel={cancellingMyId ? undefined : handleCancelMine}
          onResubmit={triggerLeaveForm}
        />
      )}

      {/* Undo bar (delete) */}
      {undoBar && (
        <div className="fixed bottom-16 left-1/2 z-[300] flex -translate-x-1/2 items-center gap-3 rounded-xl bg-slate-900 px-5 py-3 text-sm text-white shadow-xl">
          <span>Pengajuan dihapus. Jatah cuti dikembalikan.</span>
          <button
            onClick={undoBar.undo}
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            Urungkan
          </button>
        </div>
      )}
    </div>
  );
}
