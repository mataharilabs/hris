"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

// Tombol Approve/Reject untuk cuti & reimbursement (HR only).
export function ReviewActions({ endpoint }: { endpoint: string }) {
  const [busy, setBusy] = useState<"APPROVE" | "REJECT" | null>(null);
  const router = useRouter();

  async function act(action: "APPROVE" | "REJECT") {
    if (action === "REJECT" && !confirm("Tolak pengajuan ini?")) return;
    setBusy(action);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Gagal");
      toast(action === "APPROVE" ? "Disetujui" : "Ditolak", "success");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex justify-end gap-1">
      <Button
        size="sm"
        variant="success"
        onClick={() => act("APPROVE")}
        disabled={busy !== null}
      >
        {busy === "APPROVE" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
        Setuju
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => act("REJECT")}
        disabled={busy !== null}
      >
        {busy === "REJECT" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <X className="h-3.5 w-3.5" />
        )}
        Tolak
      </Button>
    </div>
  );
}
