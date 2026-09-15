"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, Heart, Bell, Loader2 } from "lucide-react";
import { timeAgo } from "@/lib/utils";

type Summary = {
  points: number;
  quota: { quota: number; used: number; remaining: number };
};
type Activity = {
  id: string;
  type: string;
  note: string | null;
  amount: number;
  createdAt: string;
};

const EVENT = "gami:refresh";
/** Panggil setelah aksi yang mengubah poin/kuota agar header ter-update. */
export function refreshGami() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function GamificationBar() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        fetch("/api/gamification/summary").then((r) => r.json()),
        fetch("/api/gamification/activity").then((r) => r.json()),
      ]);
      setSummary(s);
      setActivity(Array.isArray(a) ? a : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, [load]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await load();
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span
        title="Poin tahun ini"
        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
      >
        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
        {summary?.points ?? 0}
      </span>
      <span
        title="Sisa kuota kudos hari ini"
        className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
      >
        <Heart className="h-3.5 w-3.5" />
        {summary?.quota.remaining ?? 0}/{summary?.quota.quota ?? 5}
      </span>

      <div className="relative">
        <button
          onClick={toggle}
          title="Aktivitas"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <Bell className="h-5 w-5" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                Aktivitas
              </div>
              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center py-8 text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : activity.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    Belum ada aktivitas.
                  </div>
                ) : (
                  activity.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start justify-between gap-2 border-b border-slate-50 px-4 py-2.5 last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm text-slate-700">
                          {a.note ?? a.type}
                        </div>
                        <div className="text-xs text-slate-400">
                          {timeAgo(a.createdAt)}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-semibold ${
                          a.amount >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {a.amount >= 0 ? `+${a.amount}` : a.amount} pts
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
