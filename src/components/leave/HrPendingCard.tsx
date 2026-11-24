"use client";

import { Check, Loader2 } from "lucide-react";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";
import { formatLeaveDate, formatLeaveDuration, initials } from "@/lib/utils";
import { LeaveItem } from "./LeaveDetailPanel";

type Props = {
  leave: LeaveItem & { employeeName: string };
  approving: boolean;
  onApprove: () => void;
  onReject: () => void;
};

export function HrPendingCard({ leave, approving, onApprove, onReject }: Props) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
      {/* Avatar + nama */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FDE8EE] text-sm font-semibold text-[#D6194B]">
          {initials(leave.employeeName)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#1B1F2A]">{leave.employeeName}</p>
          <p className="text-xs text-slate-500">{LEAVE_TYPE_LABELS[leave.type] ?? leave.type}</p>
        </div>
      </div>

      {/* Tanggal + durasi */}
      <div>
        <p className="text-sm font-medium text-slate-700">
          {formatLeaveDate(leave.startDate, leave.endDate)}
        </p>
        <p className="text-xs text-slate-400">
          {formatLeaveDuration(leave.days, leave.isHalfDay, leave.halfDaySession)}
        </p>
      </div>

      {/* Alasan */}
      {leave.reason && (
        <p className="line-clamp-2 text-sm text-slate-600">{leave.reason}</p>
      )}

      {/* Chip konfirmasi */}
      <div className="flex flex-wrap gap-2">
        {leave.substitute && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
            <Check className="h-3 w-3" />
            Pengganti: {leave.substitute.name.split(" ")[0]}
          </span>
        )}
        {leave.manager && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
            <Check className="h-3 w-3" />
            Manager: {leave.manager.name.split(" ")[0]}
          </span>
        )}
      </div>

      {/* Aksi */}
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          disabled={approving}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {approving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Setujui
        </button>
        <button
          onClick={onReject}
          disabled={approving}
          className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Tolak
        </button>
      </div>
    </div>
  );
}
