"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";

// Hapus pengajuan cuti (HR Admin). Jatah cuti otomatis kembali.
export function DeleteLeaveButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function remove() {
    if (
      !confirm(
        "Hapus pengajuan cuti ini? Jatah cuti karyawan akan dikembalikan."
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leave/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Gagal menghapus");
      toast("Pengajuan dihapus, jatah cuti dikembalikan", "success");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      title="Hapus pengajuan"
      className="inline-flex items-center rounded-lg p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}
