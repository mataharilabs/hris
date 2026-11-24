"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export function CancelBlastButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function cancel() {
    if (!confirm("Batalkan pesan yang sudah dijadwalkan ini?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/wa-blast/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Gagal membatalkan");
      toast("Jadwal pesan dibatalkan", "success");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={cancel}
      disabled={loading}
      title="Batalkan jadwal"
      className="inline-flex items-center rounded-lg p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <X className="h-4 w-4" />
      )}
    </button>
  );
}
