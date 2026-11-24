"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Check, AlertCircle, CalendarDays, User, Users } from "lucide-react";
import { LeaveStatusBadge } from "./LeaveStatusBadge";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";
import { formatLeaveDate, formatLeaveDuration, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type LeaveItem = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  isHalfDay: boolean;
  halfDaySession: string | null;
  reason: string | null;
  task: string | null;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  substituteId: string | null;
  managerId: string | null;
  substitute: { name: string } | null;
  manager: { name: string } | null;
  createdAt: string;
  employeeName?: string;
};

type Props = {
  leave: LeaveItem;
  isEmployee?: boolean;
  onClose: () => void;
  onCancel?: (id: string) => void;
  onResubmit?: () => void;
};

type TimelineStep = {
  label: string;
  sub?: string;
  done: boolean;
  error?: boolean;
  active?: boolean;
};

function buildTimeline(leave: LeaveItem): TimelineStep[] {
  const steps: TimelineStep[] = [
    {
      label: "Pengajuan dikirim",
      sub: formatDate(leave.createdAt),
      done: true,
    },
    {
      label: "Dikonfirmasi pengganti",
      sub: leave.substitute?.name ?? undefined,
      done: !!leave.substituteId,
    },
    {
      label: "Dikonfirmasi manager",
      sub: leave.manager?.name ?? undefined,
      done: !!leave.managerId,
    },
  ];

  if (leave.status === "PENDING") {
    steps.push({ label: "Menunggu persetujuan HR", done: false, active: true });
  } else if (leave.status === "APPROVED") {
    steps.push({
      label: "Disetujui HR",
      sub: leave.reviewedAt ? formatDate(leave.reviewedAt) : undefined,
      done: true,
    });
  } else if (leave.status === "REJECTED") {
    steps.push({
      label: "Ditolak HR",
      sub: leave.reviewedAt ? formatDate(leave.reviewedAt) : undefined,
      done: true,
      error: true,
    });
  } else if (leave.status === "CANCELLED") {
    steps.push({ label: "Dibatalkan", done: true, error: false });
  }

  return steps;
}

export function LeaveDetailPanel({ leave, isEmployee, onClose, onCancel, onResubmit }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const timeline = buildTimeline(leave);

  if (typeof window === "undefined") return null;

  const panel = (
    <div className="fixed inset-0 z-[150]" role="dialog" aria-modal="true">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel — right drawer desktop / bottom sheet mobile */}
      <div className="absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col rounded-t-[18px] bg-white shadow-xl sm:bottom-auto sm:right-0 sm:top-0 sm:left-auto sm:h-full sm:w-[400px] sm:max-h-full sm:rounded-none sm:rounded-l-[18px]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#1B1F2A]">
              {LEAVE_TYPE_LABELS[leave.type] ?? leave.type}
            </span>
            <LeaveStatusBadge status={leave.status} />
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-[#D6194B]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {leave.employeeName && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-slate-400" />
              <span className="font-medium text-slate-700">{leave.employeeName}</span>
            </div>
          )}

          {/* Tanggal & durasi */}
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-800">
                {formatLeaveDate(leave.startDate, leave.endDate)}
              </p>
              <p className="text-xs text-slate-500">
                {formatLeaveDuration(leave.days, leave.isHalfDay, leave.halfDaySession)}
              </p>
            </div>
          </div>

          {/* Alasan */}
          {leave.reason && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                Alasan
              </p>
              <p className="text-sm text-slate-700">{leave.reason}</p>
            </div>
          )}

          {/* Task / handover */}
          {leave.task && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                Pekerjaan yang diserahkan
              </p>
              <p className="text-sm text-slate-700">{leave.task}</p>
            </div>
          )}

          {/* Catatan penolakan */}
          {leave.status === "REJECTED" && leave.reviewNote && (
            <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <div>
                <p className="text-xs font-semibold text-red-700">Catatan penolakan</p>
                <p className="mt-0.5 text-sm text-red-700">{leave.reviewNote}</p>
              </div>
            </div>
          )}

          {/* Pengganti & Manager */}
          {(leave.substitute || leave.manager) && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Konfirmasi
              </p>
              {leave.substitute && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                    <Check className="h-3 w-3 text-emerald-600" />
                  </span>
                  <span className="text-slate-500">Pengganti:</span>
                  <span className="font-medium text-slate-700">{leave.substitute.name}</span>
                </div>
              )}
              {leave.manager && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                    <Check className="h-3 w-3 text-emerald-600" />
                  </span>
                  <span className="text-slate-500">Manager:</span>
                  <span className="font-medium text-slate-700">{leave.manager.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Timeline persetujuan */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              Alur persetujuan
            </p>
            <div className="relative ml-2.5">
              {timeline.map((step, i) => (
                <div key={i} className={cn("relative mb-3 pl-6", i < timeline.length - 1 && "pb-1")}>
                  {/* Connector line */}
                  {i < timeline.length - 1 && (
                    <div className="absolute left-[9px] top-5 h-full w-0.5 bg-slate-200" />
                  )}
                  {/* Dot */}
                  <div
                    className={cn(
                      "absolute left-0 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2",
                      step.done && !step.error
                        ? "border-emerald-500 bg-emerald-500"
                        : step.done && step.error
                        ? "border-red-500 bg-red-500"
                        : step.active
                        ? "border-amber-400 bg-white"
                        : "border-slate-300 bg-white"
                    )}
                  >
                    {step.done && !step.error && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                    {step.done && step.error && (
                      <X className="h-3 w-3 text-white" />
                    )}
                    {step.active && (
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                    )}
                  </div>
                  <p className={cn("text-sm font-medium", step.error ? "text-red-700" : step.active ? "text-amber-700" : step.done ? "text-slate-700" : "text-slate-400")}>
                    {step.label}
                  </p>
                  {step.sub && (
                    <p className="text-xs text-slate-400">{step.sub}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer — aksi (karyawan saja) */}
        {isEmployee && (leave.status === "PENDING" || leave.status === "REJECTED") && (
          <div className="shrink-0 border-t border-slate-100 px-5 py-4 flex gap-2">
            {leave.status === "PENDING" && onCancel && (
              <button
                onClick={() => onCancel(leave.id)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Batalkan pengajuan
              </button>
            )}
            {leave.status === "REJECTED" && onResubmit && (
              <button
                onClick={onResubmit}
                className="flex-1 rounded-xl bg-[#D6194B] px-4 py-2 text-sm font-medium text-white hover:bg-[#B01239]"
              >
                Ajukan ulang
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
