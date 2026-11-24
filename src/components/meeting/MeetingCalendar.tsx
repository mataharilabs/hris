"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  X,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { BookingModal } from "./BookingModal";

// ─── types ────────────────────────────────────────────────────────────────────

type Room = { id: string; key: string; name: string };
type Booking = {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  department: string | null;
  startAt: string;
  endAt: string;
  status: "BOOKED" | "CHECKED_IN" | "AUTO_CHECKED_IN" | "RELEASED" | "CANCELLED";
  checkedInAt: string | null;
  seriesId: string | null;
  employeeId: string;
  employeeName: string;
};
type Data = { date: string; meId: string; rooms: Room[]; bookings: Booking[] };

// ─── timeline constants ───────────────────────────────────────────────────────

const TIMELINE_START = 8;   // 08:00
const TIMELINE_END = 18;    // 18:00
const PX_PER_HOUR = 56;
const TOTAL_H = (TIMELINE_END - TIMELINE_START) * PX_PER_HOUR; // 560px
const GRACE_MS = 15 * 60 * 1000;

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function longDate(dateStr: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateStr}T00:00:00+07:00`));
}

function isoToWibHm(iso: string): { h: number; m: number } {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  return {
    h: Number(p.find((x) => x.type === "hour")?.value ?? 0),
    m: Number(p.find((x) => x.type === "minute")?.value ?? 0),
  };
}

function wibHm(iso: string): string {
  const { h, m } = isoToWibHm(iso);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hmToY(h: number, m: number): number {
  return (h + m / 60 - TIMELINE_START) * PX_PER_HOUR;
}

function isoToY(iso: string): number {
  const { h, m } = isoToWibHm(iso);
  return hmToY(h, m);
}

function blockHeight(startIso: string, endIso: string): number {
  return Math.max(22, isoToY(endIso) - isoToY(startIso));
}

function yToHhMm(y: number): string {
  const totalMins = Math.round((y / PX_PER_HOUR + TIMELINE_START) * 2) / 2 * 60;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const clampH = Math.max(TIMELINE_START, Math.min(TIMELINE_END - 1, h));
  return `${String(clampH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getNowY(): number | null {
  const { h, m } = isoToWibHm(new Date().toISOString());
  if (h < TIMELINE_START || h >= TIMELINE_END) return null;
  return hmToY(h, m);
}

function getRoomStatus(
  roomId: string,
  bookings: Booking[],
  isToday: boolean
): { label: string; cls: string } {
  const rb = bookings.filter((b) => b.roomId === roomId);
  if (!isToday) {
    return rb.length > 0
      ? { label: "Ada jadwal", cls: "bg-blue-50 text-blue-700 border-blue-200" }
      : { label: "Kosong", cls: "bg-slate-50 text-slate-500 border-slate-200" };
  }
  const now = Date.now();
  const active = rb.find(
    (b) => new Date(b.startAt).getTime() <= now && new Date(b.endAt).getTime() > now
  );
  if (active)
    return { label: "Sedang dipakai", cls: "bg-red-50 text-red-700 border-red-200" };
  return { label: "Tersedia", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

// ─── main component ───────────────────────────────────────────────────────────

export function MeetingCalendar() {
  const [date, setDate] = useState(todayWIB);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowY, setNowY] = useState<number | null>(null);
  const [hoverSlot, setHoverSlot] = useState<{ roomId: string; y: number; time: string } | null>(null);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRoomId, setModalRoomId] = useState<string | undefined>(undefined);
  const [modalStartTime, setModalStartTime] = useState<string | undefined>(undefined);
  const [animateIds, setAnimateIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());

  // Load data
  const load = useCallback(
    async (d: string, markNew = false) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/meetings?date=${d}`);
        const json: Data = await res.json();
        if (markNew && json.bookings) {
          const newIds = new Set(
            json.bookings.filter((b) => !prevIdsRef.current.has(b.id)).map((b) => b.id)
          );
          if (newIds.size > 0) {
            setAnimateIds(newIds);
            setTimeout(() => setAnimateIds(new Set()), 1500);
          }
        }
        if (json.bookings) {
          prevIdsRef.current = new Set(json.bookings.map((b) => b.id));
        }
        setData(json);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => { load(date); }, [date, load]);

  // Current time line — update every minute
  useEffect(() => {
    setNowY(getNowY());
    const id = setInterval(() => setNowY(getNowY()), 60_000);
    return () => clearInterval(id);
  }, []);

  function openBooking(roomId?: string, startTime?: string) {
    setModalRoomId(roomId);
    setModalStartTime(startTime);
    setModalOpen(true);
  }

  function handleColumnClick(roomId: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const time = yToHhMm(y);
    openBooking(roomId, time);
  }

  function handleColumnMouseMove(roomId: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slotY = Math.round(y / (PX_PER_HOUR / 2)) * (PX_PER_HOUR / 2);
    const clampedY = Math.max(0, Math.min(TOTAL_H - 1, slotY));
    setHoverSlot({ roomId, y: clampedY, time: yToHhMm(clampedY) });
  }

  async function act(id: string, action: "checkin" | "cancel", scope?: "one" | "series") {
    if (action === "cancel") {
      const msg = scope === "series"
        ? "Batalkan SELURUH seri (pertemuan mendatang)?"
        : "Batalkan booking ini?";
      if (!confirm(msg)) return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/meetings/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "cancel" ? JSON.stringify({ scope: scope ?? "one" }) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) throw new Error(d.error ?? "Gagal");
      toast(action === "checkin" ? "Check-in berhasil!" : "Booking dibatalkan", "success");
      setDetailBooking(null);
      load(date);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusyId(null);
    }
  }

  function handleBookingSuccess(created: number, skipped: string[]) {
    const msg =
      `${created} jadwal dipesan. Jangan lupa check-in.` +
      (skipped.length > 0 ? ` ${skipped.length} dilewati karena bentrok.` : "");
    toast(msg, "success");
    if (data?.date !== date) setDate(data?.date ?? date);
    else load(date, true);
  }

  const rooms = data?.rooms ?? [];
  const bookings = data?.bookings ?? [];
  const isToday = date === todayWIB();

  // ─── render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── date navigation ── */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDate(shiftDate(date, -1))}
          aria-label="Hari sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDate(shiftDate(date, 1))}
          aria-label="Hari berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
        {!isToday && (
          <Button variant="outline" size="sm" onClick={() => setDate(todayWIB())}>
            <Calendar className="h-3.5 w-3.5" />
            Hari ini
          </Button>
        )}
        <span className="text-sm text-slate-600 font-medium">{longDate(date)}</span>
      </div>

      {/* ── loading ── */}
      {loading && (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {/* ── timeline ── */}
      {!loading && (
        <div className="overflow-x-auto rounded-[18px] border border-slate-200 bg-white shadow-sm">
          <div className="min-w-[780px]">

            {/* sticky room header row */}
            <div
              className="sticky top-0 z-20 grid border-b border-slate-200 bg-white/95 backdrop-blur-sm"
              style={{ gridTemplateColumns: `56px repeat(${rooms.length}, 1fr)` }}
            >
              <div className="border-r border-slate-200" /> {/* empty corner */}
              {rooms.map((room, i) => {
                const st = getRoomStatus(room.id, bookings, isToday);
                const count = bookings.filter((b) => b.roomId === room.id).length;
                return (
                  <div
                    key={room.id}
                    className={cn(
                      "flex flex-col gap-1.5 px-3 py-3",
                      i < rooms.length - 1 && "border-r border-slate-200"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate">{room.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">{count} jadwal</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        st.cls
                      )}>
                        {st.label}
                      </span>
                      <button
                        onClick={() => openBooking(room.id)}
                        className="flex items-center gap-1 rounded-lg bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
                      >
                        + Pesan
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* timeline body */}
            <div
              className="relative grid"
              style={{ gridTemplateColumns: `56px repeat(${rooms.length}, 1fr)`, height: TOTAL_H }}
            >
              {/* time axis */}
              <div className="relative border-r border-slate-200">
                {Array.from({ length: TIMELINE_END - TIMELINE_START + 1 }, (_, i) => {
                  const h = TIMELINE_START + i;
                  return (
                    <div
                      key={h}
                      className="absolute right-0 w-full text-right pr-2"
                      style={{ top: i * PX_PER_HOUR - 8 }}
                    >
                      <span className="text-[11px] text-slate-400 leading-none">
                        {String(h).padStart(2, "0")}:00
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* room columns */}
              {rooms.map((room, i) => (
                <div
                  key={room.id}
                  className={cn(
                    "relative overflow-hidden cursor-crosshair",
                    i < rooms.length - 1 && "border-r border-slate-200"
                  )}
                  onClick={(e) => handleColumnClick(room.id, e)}
                  onMouseMove={(e) => handleColumnMouseMove(room.id, e)}
                  onMouseLeave={() => setHoverSlot(null)}
                >
                  {/* hour lines */}
                  {Array.from({ length: TIMELINE_END - TIMELINE_START + 1 }, (_, j) => (
                    <div
                      key={j}
                      className="absolute inset-x-0 border-t border-slate-100"
                      style={{ top: j * PX_PER_HOUR }}
                    />
                  ))}
                  {/* half-hour lines */}
                  {Array.from({ length: TIMELINE_END - TIMELINE_START }, (_, j) => (
                    <div
                      key={j}
                      className="absolute inset-x-0 border-t border-dashed border-slate-50"
                      style={{ top: (j + 0.5) * PX_PER_HOUR }}
                    />
                  ))}

                  {/* current time line */}
                  {isToday && nowY !== null && nowY >= 0 && nowY <= TOTAL_H && (
                    <div
                      className="absolute inset-x-0 z-30 pointer-events-none"
                      style={{ top: nowY }}
                    >
                      <div className="relative border-t-2 border-red-400">
                        <span className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-red-400" />
                      </div>
                    </div>
                  )}

                  {/* hover preview */}
                  {hoverSlot?.roomId === room.id && (
                    <div
                      className="absolute inset-x-0 z-10 pointer-events-none flex items-center"
                      style={{ top: hoverSlot.y }}
                    >
                      <span className="bg-brand-50 text-brand-700 text-[11px] font-medium px-1.5 py-0.5 rounded-r leading-tight">
                        +{hoverSlot.time}
                      </span>
                      <div className="flex-1 border-t border-dashed border-brand-200" />
                    </div>
                  )}

                  {/* booking blocks */}
                  {bookings
                    .filter((b) => b.roomId === room.id)
                    .map((b) => {
                      const y = isoToY(b.startAt);
                      const h = blockHeight(b.startAt, b.endAt);
                      const isCheckedIn = b.status === "CHECKED_IN" || b.status === "AUTO_CHECKED_IN";
                      return (
                        <div
                          key={b.id}
                          className={cn(
                            "absolute inset-x-1 z-20 rounded-md overflow-hidden cursor-pointer select-none transition-opacity hover:opacity-90",
                            isCheckedIn ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200",
                            animateIds.has(b.id) && "animate-fade-up"
                          )}
                          style={{ top: y, height: h }}
                          onClick={(e) => { e.stopPropagation(); setDetailBooking(b); }}
                        >
                          {/* left accent bar */}
                          <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]",
                            isCheckedIn ? "bg-emerald-500" : "bg-amber-500")} />
                          <div className="pl-2.5 py-1 pr-1 h-full overflow-hidden">
                            <p className="text-[11px] font-semibold leading-tight text-slate-800 truncate">
                              {b.title}
                            </p>
                            {h >= 36 && (
                              <p className="text-[10px] leading-tight text-slate-500">
                                {wibHm(b.startAt)}–{wibHm(b.endAt)}
                              </p>
                            )}
                            {h >= 54 && (
                              <p className="text-[10px] leading-tight text-slate-400 truncate">
                                {b.department ? `${b.department} · ` : ""}{b.employeeName}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>

            {/* legend */}
            <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                Sudah check-in
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                Dipesan
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── booking detail panel ── */}
      {detailBooking && (() => {
        const b = detailBooking;
        const mine = b.employeeId === data?.meId;
        const now = Date.now();
        const startMs = new Date(b.startAt).getTime();
        const canCheckin = mine && b.status === "BOOKED" && now >= startMs - GRACE_MS && now <= startMs + GRACE_MS;
        const canCancel = mine && (b.status === "BOOKED" || b.status === "CHECKED_IN");
        const isCheckedIn = b.status === "CHECKED_IN" || b.status === "AUTO_CHECKED_IN";
        return (
          <div className="fixed inset-x-0 bottom-0 z-50 sm:bottom-4 sm:right-4 sm:left-auto sm:w-80">
            <div className="rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
              {/* header */}
              <div className={cn(
                "px-4 py-3 flex items-start justify-between gap-2",
                isCheckedIn ? "bg-emerald-50 border-b border-emerald-100" : "bg-amber-50 border-b border-amber-100"
              )}>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{b.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {wibHm(b.startAt)}–{wibHm(b.endAt)} · {b.roomName}
                  </p>
                </div>
                <button
                  onClick={() => setDetailBooking(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/60 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* body */}
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs text-slate-500">
                  {b.department ? `${b.department} · ` : ""}{b.employeeName}
                </p>
                <div className="flex items-center gap-1">
                  <span className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    isCheckedIn ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                  )}>
                    {b.status === "AUTO_CHECKED_IN" ? "Auto check-in" : isCheckedIn ? "Check-in" : "Dipesan"}
                  </span>
                  {b.seriesId && (
                    <span className="text-xs text-slate-400">· Berulang</span>
                  )}
                </div>
                {(canCheckin || canCancel) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {canCheckin && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => act(b.id, "checkin")}
                        disabled={busyId === b.id}
                      >
                        {busyId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Check-in
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => act(b.id, "cancel", "one")}
                        disabled={busyId === b.id}
                      >
                        Batalkan
                      </Button>
                    )}
                    {canCancel && b.seriesId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => act(b.id, "cancel", "series")}
                        disabled={busyId === b.id}
                      >
                        Batalkan seri
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* backdrop for detail panel */}
      {detailBooking && (
        <div
          className="fixed inset-0 z-40 sm:hidden"
          onClick={() => setDetailBooking(null)}
        />
      )}

      {/* ── booking modal ── */}
      <BookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        rooms={rooms}
        initialRoomId={modalRoomId}
        initialDate={date}
        initialStartTime={modalStartTime}
        onSuccess={handleBookingSuccess}
      />
    </div>
  );
}
