import { cn } from "@/lib/utils";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_COLORS } from "@/lib/constants";

export function LeaveStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        REQUEST_STATUS_COLORS[status] ?? "bg-slate-100 text-slate-500 border-slate-200"
      )}
    >
      {REQUEST_STATUS_LABELS[status] ?? status}
    </span>
  );
}
