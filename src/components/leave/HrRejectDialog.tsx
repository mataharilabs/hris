"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";

type Props = {
  employeeName: string;
  leaveId: string;
  onClose: () => void;
  onDone: () => void;
};

export function HrRejectDialog({ employeeName, leaveId, onClose, onDone }: Props) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!note.trim()) {
      setErr("Alasan penolakan wajib diisi");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`/api/leave/${leaveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", note: note.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Gagal menolak");
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onKeyDown={handleKey}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-[18px] bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#1B1F2A]">Tolak Pengajuan</h3>
            <p className="mt-0.5 text-sm text-slate-500">{employeeName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Alasan penolakan <span className="text-red-500">*</span>
        </label>
        <textarea
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#D6194B] focus:outline-none focus:ring-2 focus:ring-[#D6194B]/20"
          rows={4}
          placeholder="Jelaskan alasan penolakan..."
          value={note}
          onChange={(e) => { setNote(e.target.value); setErr(""); }}
          autoFocus
        />
        {err && <p className="mt-1 text-xs text-red-600">{err}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Tolak Pengajuan
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
