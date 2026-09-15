"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/toaster";
import { fireConfetti } from "@/lib/confetti";

type Received = {
  id: string;
  message: string;
  createdAt: string;
  senderName: string;
};

const KEY = "hris:kudosLastSeen";

/**
 * Saat penerima membuka halaman & ada kudos baru sejak kunjungan terakhir:
 * letuskan confetti + tampilkan info dari siapa saja. Kunjungan pertama
 * dijadikan baseline (tanpa confetti) agar tidak memicu untuk data lama.
 */
export function KudosWelcome() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const res = await fetch("/api/kudos/received");
        if (!res.ok) return;
        const rows: Received[] = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) return;

        const newest = rows[0].createdAt;
        const lastSeen = localStorage.getItem(KEY);

        // Kunjungan pertama: set baseline, jangan letuskan confetti.
        if (!lastSeen) {
          localStorage.setItem(KEY, newest);
          return;
        }

        const fresh = rows.filter((k) => k.createdAt > lastSeen);
        if (fresh.length === 0) return;

        localStorage.setItem(KEY, newest);

        const senders = [...new Set(fresh.map((k) => k.senderName))];
        const who =
          senders.length <= 3
            ? senders.join(", ")
            : `${senders.slice(0, 3).join(", ")} +${senders.length - 3} lainnya`;

        fireConfetti();
        toast(
          `🎉 Kamu menerima ${fresh.length} Kudos baru dari ${who}!`,
          "success"
        );
      } catch {
        /* diamkan */
      }
    })();
  }, []);

  return null;
}
