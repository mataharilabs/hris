"use client";

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

const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum"];

function greeting(hour: number) {
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}


type Props = {
  name: string;
  initialCheckedIn: boolean;
  initialStreak: number;
  initialWeek: boolean[];
  coworkersCheckedIn: number;
  totalCoworkers: number;
};

export function CheckinHero({
  name,
  initialCheckedIn,
  initialStreak,
  initialWeek,
  coworkersCheckedIn,
  totalCoworkers,
}: Props) {
  const firstName = name.split(" ")[0];
  const hour = new Date().getHours();

  const [checkedIn, setCheckedIn] = useState(initialCheckedIn);
  const [streak, setStreak] = useState(initialStreak);
  const [week, setWeek] = useState(initialWeek);
  const [coworkers, setCoworkers] = useState(coworkersCheckedIn);
  const [mood, setMood] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent<{ streak: number }>).detail;
      setCheckedIn(true);
      if (detail?.streak !== undefined) setStreak(detail.streak);
      setCoworkers((c) => c + 1);
      setWeek((prev) => {
        const dow = new Date().getDay();
        const idx = dow === 0 ? 4 : dow - 1;
        const next = [...prev];
        if (idx < 5) next[idx] = true;
        return next;
      });
    };
    window.addEventListener("checkin:done", h);
    return () => window.removeEventListener("checkin:done", h);
  }, []);

  async function doCheckin() {
    if (checkedIn || busy) return;
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
        setCheckedIn(true);
        setStreak(newStreak);
        setCoworkers((c) => c + 1);
        setWeek((prev) => {
          const todayDow = new Date().getDay();
          const idx = todayDow === 0 ? 4 : todayDow - 1;
          const next = [...prev];
          if (idx < 5) next[idx] = true;
          return next;
        });
        refreshGami();
        fireConfetti();
        window.dispatchEvent(new CustomEvent("checkin:done", { detail: { streak: newStreak } }));
      }
    } finally {
      setBusy(false);
    }
  }

  const checkinTime = checkedIn
    ? new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : null;

  const nextMilestone = streak < 7 ? 7 : streak < 14 ? 14 : Math.ceil((streak + 1) / 7) * 7;
  const bonusPoints = streak + 1 === 7 ? 20 : 0;

  const heroCard = (
    <div
      className={cn(
        "mb-5 grid grid-cols-1 gap-5 rounded-[18px] border border-transparent p-5 shadow-[0_10px_30px_rgba(214,25,75,0.12)] transition-all duration-500",
        "lg:grid-cols-[1.3fr_1fr]",
        checkedIn
          ? "bg-gradient-to-br from-emerald-50 to-white shadow-[0_10px_30px_rgba(22,121,76,0.1)]"
          : "bg-gradient-to-br from-[#FDE8EE] to-white"
      )}
    >
      {/* Left — greeting + mood + button */}
      <div>
        <h2 className={cn(
          "text-xl font-extrabold tracking-tight",
          checkedIn ? "text-emerald-800" : "text-slate-900"
        )}>
          {checkedIn ? "Check-in berhasil" : `${greeting(hour)}, ${firstName}`}
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {checkedIn
            ? `Terima kasih${mood ? `, suasana hati tercatat (${mood.toLowerCase()})` : ""}. Sampai jumpa besok.`
            : "Bagaimana suasana hati Anda hari ini? Pilih satu, lalu check-in."}
        </p>

        {/* Mood picker */}
        <div className={cn("mt-4 flex gap-2", checkedIn && "pointer-events-none opacity-60")}>
          {MOODS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMood(m.key)}
              className={cn(
                "flex flex-1 max-w-[80px] flex-col items-center rounded-[14px] border-[1.5px] px-1 py-2 text-[11.5px] font-semibold transition-all",
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

        {/* Check-in button */}
        <button
          type="button"
          onClick={doCheckin}
          disabled={busy || checkedIn || (!checkedIn && !mood)}
          className={cn(
            "mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-[14px] text-base font-bold text-white transition-all",
            checkedIn
              ? "bg-emerald-600 cursor-default opacity-80"
              : "bg-[#D6194B] hover:bg-[#B01239] active:scale-[.97]",
            (busy || checkedIn || (!checkedIn && !mood)) && "cursor-not-allowed opacity-50"
          )}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : checkedIn ? (
            `✓ Sudah check-in · ${checkinTime}`
          ) : (
            `Check-in sekarang · +5 poin${bonusPoints ? ` (+${bonusPoints} bonus)` : ""}`
          )}
        </button>
      </div>

      {/* Right — streak + week */}
      <div className="flex flex-col justify-center gap-3 border-slate-200 lg:border-l lg:pl-5 border-t pt-4 lg:border-t-0 lg:pt-0">
        <div>
          <div className="text-[34px] font-extrabold leading-none tracking-tight text-slate-900">
            {streak}
            <span className="ml-1 text-sm font-semibold text-slate-400">hari beruntun</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {checkedIn
              ? streak % 7 === 0 && streak > 0
                ? `Luar biasa! Bonus streak ${streak} hari diraih 🔥`
                : `Terus beruntun, bonus berikutnya di hari ke-${nextMilestone}.`
              : `Check-in hari ini untuk mencapai ${nextMilestone} hari${bonusPoints ? ` dan dapat bonus +${bonusPoints} poin` : ""}.`}
          </p>
        </div>

        {/* Week view */}
        <div className="flex gap-1.5">
          {DAYS.map((d, i) => (
            <div key={d} className="flex flex-1 flex-col items-center">
              <span className="text-[11.5px] font-bold text-slate-400">{d}</span>
              <div
                className={cn(
                  "mt-1 flex h-8 w-full max-w-9 items-center justify-center rounded-full border-2 text-xs font-semibold text-white",
                  week[i]
                    ? "border-emerald-500 bg-emerald-500"
                    : i === (new Date().getDay() === 0 ? 4 : new Date().getDay() - 1)
                      ? "border-dashed border-[#D6194B] text-[#D6194B] bg-transparent"
                      : "border-dashed border-slate-200 bg-transparent text-transparent"
                )}
              >
                {week[i] ? "✓" : ""}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400">
          {coworkers} dari {totalCoworkers} rekan sudah check-in hari ini.
        </p>
      </div>
    </div>
  );

  return heroCard;
}
