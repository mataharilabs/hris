"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Activity as ActivityIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";

type Item = {
  id: string;
  type: string;
  note: string | null;
  amount: number;
  createdAt: string;
};

export function ActivityFeed() {
  const [items, setItems] = useState<Item[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/gamification/activity");
      setItems(res.ok ? await res.json() : []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("gami:refresh", h);
    return () => window.removeEventListener("gami:refresh", h);
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ActivityIcon className="h-4 w-4 text-brand-600" />
          Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items === null ? (
          <div className="flex justify-center py-8 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            Belum ada aktivitas. Kirim kudos atau check-in untuk mulai!
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {items.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm text-slate-700">{a.note ?? a.type}</div>
                  <div className="text-xs text-slate-400">{timeAgo(a.createdAt)}</div>
                </div>
                <span
                  className={`shrink-0 text-xs font-semibold ${
                    a.amount >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {a.amount >= 0 ? `+${a.amount}` : a.amount} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
