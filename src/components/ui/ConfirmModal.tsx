"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Ya, lanjutkan",
  variant = "default",
  loading,
  onConfirm,
  onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-2">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">{message}</p>
        <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50",
              variant === "danger"
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-[#D6194B] text-white hover:bg-[#b51440]"
            )}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
