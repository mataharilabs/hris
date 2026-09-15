"use client";

import { useState } from "react";
import { CalendarCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { refreshGami } from "./GamificationBar";
import { fireConfetti } from "@/lib/confetti";

export function DailyCheckin() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function checkin() {
    setBusy(true);
    try {
      const res = await fetch("/api/gamification/checkin", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        toast("Check-in harian berhasil (+5 poin) ✅", "success");
        setDone(true);
        refreshGami();
        fireConfetti();
      } else {
        toast(d.error ?? "Gagal check-in", "info");
        setDone(true);
      }
    } catch {
      toast("Gagal check-in", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={checkin} disabled={busy || done} variant="outline">
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CalendarCheck className="h-4 w-4" />
      )}
      {done ? "Sudah Check-in" : "Check-in Harian (+5)"}
    </Button>
  );
}
