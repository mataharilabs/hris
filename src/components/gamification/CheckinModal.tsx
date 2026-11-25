"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { refreshGami } from "./GamificationBar";
import { fireConfetti } from "@/lib/confetti";

const MOODS = [
  { key: "Semangat", emoji: "😄" },
  { key: "Baik", emoji: "🙂" },
  { key: "Biasa", emoji: "😐" },
  { key: "Lelah", emoji: "😮‍💨" },
  { key: "Kurang baik", emoji: "😕" },
];

function greeting(h: number) {
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

function greetingEmoji(h: number) {
  if (h < 11) return "☀️";
  if (h < 15) return "🌤️";
  if (h < 18) return "🌇";
  return "🌙";
}

export function CheckinModal() {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [name, setName] = useState("");
  const [mood, setMood] = useState("");
  const [busy, setBusy] = useState(false);

  const hour = new Date().getHours();

  useEffect(() => {
    setMounted(true);
    // delay kecil agar halaman render dulu
    const t = setTimeout(() => {
      fetch("/api/gamification/checkin")
        .then((r) => r.json())
        .then((d) => {
          if (!d.checkedIn) {
            setStreak(d.streak ?? 0);
            setName(d.name ?? "");
            setShow(true);
          }
        })
        .catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, []);

  async function doCheckin() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/gamification/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        const newStreak = d.streak ?? streak + 1;
        setStreak(newStreak);
        setDone(true);
        refreshGami();
        fireConfetti();
        window.dispatchEvent(
          new CustomEvent("checkin:done", { detail: { streak: newStreak } })
        );
      }
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !show) return null;

  const firstName = name.split(" ")[0] || "";
  const nextMilestone =
    streak < 7 ? 7 : streak < 14 ? 14 : Math.ceil((streak + 1) / 7) * 7;
  const bonusPoints = streak + 1 === 7 ? 20 : 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[440px] rounded-[22px] bg-white p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        {!done ? (
          <>
            <div className="text-center text-4xl">{greetingEmoji(hour)}</div>
            <h2 className="mt-2 text-center text-xl font-extrabold text-slate-900">
              {greeting(hour)}{firstName ? `, ${firstName}` : ""}
            </h2>
            <p className="mt-1 text-center text-sm text-slate-500">
              Pilih suasana hati hari ini dan check-in untuk dapat +5 poin.
            </p>

            <div className="mt-4 flex gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMood(m.key)}
                  className={cn(
                    "flex flex-1 flex-col items-center rounded-[14px] border-[1.5px] px-1 py-2 text-[11.5px] font-semibold transition-all",
                    mood === m.key
                      ? "border-[#D6194B] bg-[#FDE8EE] text-[#D6194B] -translate-y-0.5"
                      : "border-slate-200 bg-white text-slate-400 hover:border-[#D6194B]"
                  )}
                >
                  <span className="mb-0.5 text-2xl leading-none">{m.emoji}</span>
                  {m.key}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={doCheckin}
              disabled={!mood || busy}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#D6194B] text-base font-bold text-white hover:bg-[#B01239] disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Check-in sekarang"
              )}
            </button>

            <p className="mt-2 text-center text-xs text-slate-400">
              🔥 Streak{" "}
              <strong>{streak} hari</strong>. Hari ke-{nextMilestone} dapat bonus
              {bonusPoints ? ` +${bonusPoints} poin` : ""}.
            </p>

            <button
              type="button"
              onClick={() => setShow(false)}
              className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600"
            >
              Nanti saja
            </button>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl font-extrabold text-emerald-600 animate-in zoom-in duration-300">
              ✓
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Check-in berhasil!
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              +5 poin. Streak Anda sekarang {streak} hari
              {streak % 7 === 0 && streak > 0 ? " dan bonus sudah masuk 🎉" : ""}.
            </p>
            <button
              type="button"
              onClick={() => setShow(false)}
              className="mt-5 h-12 w-full rounded-[14px] bg-[#D6194B] text-base font-bold text-white hover:bg-[#B01239]"
            >
              Lanjut
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
