"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Gift, Loader2, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { refreshGami } from "./GamificationBar";

type Step = { key: string; label: string; done: boolean };
type Onboarding = {
  steps: Step[];
  percent: number;
  claimed: boolean;
  claimable: boolean;
};

export function OnboardingQuest() {
  const [data, setData] = useState<Onboarding | null>(null);
  const [claiming, setClaiming] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding");
      if (res.ok) setData(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("gami:refresh", h);
    return () => window.removeEventListener("gami:refresh", h);
  }, [load]);

  async function claim() {
    setClaiming(true);
    try {
      const res = await fetch("/api/onboarding/claim", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) throw new Error(d.error ?? "Gagal klaim");
      toast("Selamat datang! Reward +25 poin diklaim 🎉", "success");
      refreshGami();
      load();
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setClaiming(false);
    }
  }

  if (!data) return null;
  if (data.claimed) return null; // selesai & sudah diklaim → sembunyikan

  return (
    <Card className="mb-6 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h2 className="text-base font-semibold text-slate-900">
          Onboarding Quest
        </h2>
        <span className="ml-auto text-sm font-semibold text-brand-700">
          {data.percent}%
        </span>
      </div>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${data.percent}%` }}
        />
      </div>

      <div className="space-y-2">
        {data.steps.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-sm">
            {s.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <Circle className="h-4 w-4 text-slate-300" />
            )}
            <span className={s.done ? "text-slate-500 line-through" : "text-slate-700"}>
              {s.label}
            </span>
            <span className="ml-auto text-xs text-slate-400">25%</span>
          </div>
        ))}
      </div>

      <div className="mt-4">
        {data.claimable ? (
          <Button onClick={claim} disabled={claiming} className="w-full">
            {claiming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Gift className="h-4 w-4" />
            )}
            Klaim Reward Selamat Datang (+25 poin)
          </Button>
        ) : (
          <p className="text-center text-xs text-slate-400">
            Selesaikan semua langkah untuk klaim reward +25 poin.
          </p>
        )}
      </div>
    </Card>
  );
}
