"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { X, Loader2, AlertTriangle, CheckCircle2, DoorOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── types ────────────────────────────────────────────────────────────────────

type Room = { id: string; key: string; name: string };

type SlotStatus =
  | { type: "ok" }
  | { type: "error"; message: string }
  | { type: "clash"; clash: { title: string; start: string; end: string; employeeName: string } }
  | null;

type BookingForm = {
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
  department: string;
  title: string;
  recur: boolean;
  freq: "WEEKLY" | "WEEKDAY" | "MONTHLY";
  weekdays: number[];
  endMode: "date" | "count";
  untilDate: string;
  count: number;
};

export type BookingModalProps = {
  open: boolean;
  onClose: () => void;
  rooms: Room[];
  initialRoomId?: string;
  initialDate: string;
  initialStartTime?: string;
  onSuccess: (created: number, skipped: string[]) => void;
};

// ─── constants ────────────────────────────────────────────────────────────────

const TIMELINE_START = 8;
const TIMELINE_END = 18;
const MAX_RECUR = 60;

const WEEKDAYS = [
  { v: 1, l: "Sen" },
  { v: 2, l: "Sel" },
  { v: 3, l: "Rab" },
  { v: 4, l: "Kam" },
  { v: 5, l: "Jum" },
  { v: 6, l: "Sab" },
  { v: 0, l: "Min" },
];

const DURATION_CHIPS = [
  { label: "30 mnt", mins: 30 },
  { label: "1 jam", mins: 60 },
  { label: "1,5 jam", mins: 90 },
  { label: "2 jam", mins: 120 },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(h * 60 + m + mins, TIMELINE_END * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function getCurrentDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateStr}T12:00:00Z`));
}

function previewOccurrences(form: BookingForm): { count: number; first: string; last: string } | null {
  if (!form.recur || !form.date) return null;
  const max = form.endMode === "count" ? Math.min(Math.max(1, form.count), MAX_RECUR) : MAX_RECUR;
  const dates: string[] = [];
  let cur = form.date;
  const anchorDom = parseInt(form.date.slice(8, 10), 10);
  for (let i = 0; i < 220 && dates.length < max; i++) {
    const d = new Date(`${cur}T12:00:00Z`);
    const wd = d.getUTCDay();
    const dom = d.getUTCDate();
    let match = false;
    if (form.freq === "WEEKDAY") match = wd >= 1 && wd <= 5;
    else if (form.freq === "WEEKLY") match = form.weekdays.includes(wd);
    else if (form.freq === "MONTHLY") match = dom === anchorDom;
    if (match) dates.push(cur);
    if (form.endMode === "date" && form.untilDate && cur >= form.untilDate) break;
    const next = new Date(`${cur}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    cur = next.toISOString().slice(0, 10);
  }
  if (dates.length === 0) return null;
  return { count: dates.length, first: dates[0], last: dates[dates.length - 1] };
}

// ─── component ────────────────────────────────────────────────────────────────

export function BookingModal({
  open,
  onClose,
  rooms,
  initialRoomId,
  initialDate,
  initialStartTime,
  onSuccess,
}: BookingModalProps) {
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<BookingForm>({
    roomId: "",
    date: "",
    startTime: "09:00",
    endTime: "10:00",
    department: "",
    title: "",
    recur: false,
    freq: "WEEKLY",
    weekdays: [],
    endMode: "date",
    untilDate: "",
    count: 8,
  });
  const [slotStatus, setSlotStatus] = useState<SlotStatus>(null);
  const [checkingSlot, setCheckingSlot] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);

  // Init form when modal opens
  useEffect(() => {
    if (!open) return;
    const startTime = initialStartTime ?? "09:00";
    const wd = new Date(`${initialDate}T12:00:00Z`).getUTCDay();
    setForm({
      roomId: initialRoomId ?? rooms[0]?.id ?? "",
      date: initialDate,
      startTime,
      endTime: addMinutes(startTime, 60),
      department: "",
      title: "",
      recur: false,
      freq: "WEEKLY",
      weekdays: [wd],
      endMode: "date",
      untilDate: "",
      count: 8,
    });
    setSlotStatus(null);
    setErr(null);
    setTimeout(() => titleRef.current?.focus(), 100);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Real-time conflict check (debounced)
  useEffect(() => {
    if (!open || !form.roomId || !form.date || !form.startTime || !form.endTime) {
      setSlotStatus(null);
      return;
    }
    const [sh, sm] = form.startTime.split(":").map(Number);
    const [eh, em] = form.endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    if (endMins <= startMins) {
      setSlotStatus({ type: "error", message: "Jam selesai harus setelah jam mulai" });
      return;
    }
    if (sh < TIMELINE_START || eh > TIMELINE_END || (eh === TIMELINE_END && em > 0)) {
      setSlotStatus({ type: "error", message: `Jam operasional 0${TIMELINE_START}:00–${TIMELINE_END}:00` });
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingSlot(true);
      try {
        const r = await fetch(
          `/api/meetings/check?roomId=${form.roomId}&date=${form.date}&start=${form.startTime}&end=${form.endTime}`
        );
        const data = await r.json().catch(() => ({}));
        if (data.available) {
          setSlotStatus({ type: "ok" });
        } else if (data.clash) {
          setSlotStatus({ type: "clash", clash: data.clash });
        } else {
          setSlotStatus({ type: "error", message: data.error ?? "Gagal mengecek slot" });
        }
      } catch {
        setSlotStatus(null);
      } finally {
        setCheckingSlot(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [open, form.roomId, form.date, form.startTime, form.endTime]);

  function set<K extends keyof BookingForm>(k: K, v: BookingForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleWeekday(v: number) {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(v) ? f.weekdays.filter((x) => x !== v) : [...f.weekdays, v],
    }));
  }

  async function submit() {
    if (!form.roomId) return setErr("Pilih ruang meeting");
    if (!form.date) return setErr("Pilih tanggal");
    if (!form.title.trim()) return setErr("Isi deskripsi kegiatan");
    if (slotStatus?.type === "clash") return setErr("Slot bentrok, pilih waktu lain");
    if (form.recur) {
      if (form.freq === "WEEKLY" && form.weekdays.length === 0) return setErr("Pilih minimal satu hari");
      if (form.endMode === "date" && !form.untilDate) return setErr("Isi tanggal berakhir");
    }
    setErr(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        roomId: form.roomId,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        department: form.department,
        title: form.title,
      };
      if (form.recur) {
        body.recurrence = {
          freq: form.freq,
          weekdays: form.freq === "WEEKLY" ? form.weekdays : undefined,
          endMode: form.endMode,
          untilDate: form.endMode === "date" ? form.untilDate : undefined,
          count: form.endMode === "count" ? Math.min(form.count, MAX_RECUR) : undefined,
        };
      }
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) throw new Error(d.error ?? "Gagal memesan");
      onSuccess(d.created ?? 1, d.skipped ?? []);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const recurPreview = previewOccurrences(form);
  const selectedRoom = rooms.find((r) => r.id === form.roomId);
  const curDuration = getCurrentDuration(form.startTime, form.endTime);
  const submitDisabled = saving || slotStatus?.type === "clash";

  if (!mounted) return null;

  const modal = open ? (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex w-full max-w-[520px] flex-col bg-white shadow-2xl rounded-t-[22px] sm:rounded-[22px] max-h-[95dvh] sm:max-h-[90vh]">

        {/* sticky header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Pesan Ruang Meeting</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* room banner / select */}
          {rooms.length === 1 || initialRoomId ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
              <DoorOpen className="h-4 w-4 text-brand-600 shrink-0" />
              <span className="text-sm font-medium text-brand-700">
                {selectedRoom?.name ?? "Ruang Meeting"}
              </span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Ruang Meeting *</Label>
              <select
                value={form.roomId}
                onChange={(e) => set("roomId", e.target.value)}
                className="h-12 w-full rounded-xl border-[1.5px] border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              >
                <option value="">— Pilih ruang —</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* tanggal */}
          <div className="space-y-1.5">
            <Label>Tanggal *</Label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className="h-12 w-full rounded-xl border-[1.5px] border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </div>

          {/* jam mulai + selesai */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Jam Mulai *</Label>
              <input
                type="time"
                value={form.startTime}
                min={`0${TIMELINE_START}:00`}
                max={`${TIMELINE_END - 1}:30`}
                onChange={(e) => {
                  const v = e.target.value;
                  set("startTime", v);
                  set("endTime", addMinutes(v, curDuration > 0 ? curDuration : 60));
                }}
                className="h-12 w-full rounded-xl border-[1.5px] border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Jam Selesai *</Label>
              <input
                type="time"
                value={form.endTime}
                min={form.startTime}
                max={`${TIMELINE_END}:00`}
                onChange={(e) => set("endTime", e.target.value)}
                className="h-12 w-full rounded-xl border-[1.5px] border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              />
            </div>
          </div>

          {/* duration chips */}
          <div className="flex flex-wrap gap-2">
            {DURATION_CHIPS.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => set("endTime", addMinutes(form.startTime, c.mins))}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  curDuration === c.mins
                    ? "border-brand-400 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* slot status */}
          {(checkingSlot || slotStatus) && (
            <div className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm",
              checkingSlot
                ? "border-slate-200 bg-slate-50 text-slate-500"
                : slotStatus?.type === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : slotStatus?.type === "clash"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-red-200 bg-red-50 text-red-700"
            )}>
              {checkingSlot ? (
                <><Loader2 className="h-4 w-4 animate-spin shrink-0" /> Mengecek slot…</>
              ) : slotStatus?.type === "ok" ? (
                <><CheckCircle2 className="h-4 w-4 shrink-0" /> Slot tersedia</>
              ) : slotStatus?.type === "clash" ? (
                <>
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Bentrok dengan <strong>&ldquo;{slotStatus.clash.title}&rdquo;</strong>
                    {" "}({slotStatus.clash.start}–{slotStatus.clash.end},{" "}
                    {slotStatus.clash.employeeName})
                  </span>
                </>
              ) : slotStatus?.type === "error" ? (
                <><AlertTriangle className="h-4 w-4 shrink-0" /> {slotStatus.message}</>
              ) : null}
            </div>
          )}

          {/* divisi */}
          <div className="space-y-1.5">
            <Label>
              Divisi / Departemen{" "}
              <span className="font-normal text-slate-400">(opsional)</span>
            </Label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              placeholder="Kosongkan untuk pakai divisi Anda"
              className="h-12 w-full rounded-xl border-[1.5px] border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 placeholder:text-slate-400"
            />
          </div>

          {/* deskripsi kegiatan */}
          <div className="space-y-1.5">
            <Label>Deskripsi Kegiatan *</Label>
            <Textarea
              ref={titleRef}
              value={form.title}
              onChange={(e) => { set("title", e.target.value); if (err) setErr(null); }}
              placeholder="Agenda / topik meeting"
            />
          </div>

          {/* recurrence */}
          <div className="rounded-xl border-[1.5px] border-slate-200 p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded accent-brand-500"
                checked={form.recur}
                onChange={(e) => set("recur", e.target.checked)}
              />
              <div>
                <p className="text-sm font-medium text-slate-700">Ulangi (meeting berulang)</p>
                <p className="text-xs text-slate-400">Jadwalkan otomatis beberapa pertemuan</p>
              </div>
            </label>

            {form.recur && (
              <div className="mt-4 space-y-4 pl-7">
                {/* freq */}
                <div className="space-y-1.5">
                  <Label>Pola pengulangan</Label>
                  <select
                    value={form.freq}
                    onChange={(e) => set("freq", e.target.value as BookingForm["freq"])}
                    className="h-12 w-full rounded-xl border-[1.5px] border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  >
                    <option value="WEEKLY">Mingguan (pilih hari)</option>
                    <option value="WEEKDAY">Harian Senin–Jumat</option>
                    <option value="MONTHLY">Bulanan (tanggal sama)</option>
                  </select>
                </div>

                {/* weekday chips */}
                {form.freq === "WEEKLY" && (
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((d) => (
                      <button
                        key={d.v}
                        type="button"
                        onClick={() => toggleWeekday(d.v)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                          form.weekdays.includes(d.v)
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {d.l}
                      </button>
                    ))}
                  </div>
                )}

                {/* end mode */}
                <div className="space-y-3">
                  <Label>Berakhir</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={form.endMode === "date"}
                        onChange={() => set("endMode", "date")}
                        className="accent-brand-500"
                      />
                      <span className="text-sm text-slate-700 w-28">Sampai tanggal</span>
                      <input
                        type="date"
                        value={form.untilDate}
                        disabled={form.endMode !== "date"}
                        min={form.date}
                        onChange={(e) => set("untilDate", e.target.value)}
                        className="h-10 flex-1 rounded-xl border-[1.5px] border-slate-200 bg-white px-3 text-sm outline-none disabled:opacity-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                      />
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={form.endMode === "count"}
                        onChange={() => set("endMode", "count")}
                        className="accent-brand-500"
                      />
                      <span className="text-sm text-slate-700 w-28">Jumlah pertemuan</span>
                      <input
                        type="number"
                        min={1}
                        max={MAX_RECUR}
                        value={form.count}
                        disabled={form.endMode !== "count"}
                        onChange={(e) => set("count", Number(e.target.value))}
                        className="h-10 w-24 rounded-xl border-[1.5px] border-slate-200 bg-white px-3 text-sm outline-none disabled:opacity-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                      />
                    </label>
                  </div>
                </div>

                {/* recur preview */}
                {recurPreview && (
                  <div className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
                    <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <strong>{recurPreview.count} pertemuan</strong>
                      {", "}
                      {formatDateLabel(recurPreview.first)} s/d{" "}
                      {formatDateLabel(recurPreview.last)}.
                      {form.endMode === "count" && recurPreview.count >= MAX_RECUR && (
                        <> Maks. {MAX_RECUR} pertemuan.</>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* error */}
          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}
        </div>

        {/* sticky footer */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-6 py-4">
          <Button variant="outline" onClick={onClose} className="shrink-0">
            Batal
          </Button>
          <Button
            onClick={submit}
            disabled={submitDisabled}
            className="flex-1 sm:flex-none"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Memesan…" : "Pesan Ruangan"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return createPortal(modal ?? <></>, document.body);
}
