"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
  DoorOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";

type Room = { id: string; key: string; name: string };
type Booking = {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  department: string | null;
  startAt: string;
  endAt: string;
  status: "BOOKED" | "CHECKED_IN" | "RELEASED" | "CANCELLED";
  checkedInAt: string | null;
  seriesId: string | null;
  employeeId: string;
  employeeName: string;
};

const WEEKDAYS = [
  { v: 1, l: "Sen" },
  { v: 2, l: "Sel" },
  { v: 3, l: "Rab" },
  { v: 4, l: "Kam" },
  { v: 5, l: "Jum" },
  { v: 6, l: "Sab" },
  { v: 0, l: "Min" },
];
type Data = { date: string; meId: string; rooms: Room[]; bookings: Booking[] };

const GRACE_MS = 15 * 60 * 1000;

function todayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date()
  );
}
function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function hhmm(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
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

export function MeetingCalendar() {
  const [date, setDate] = useState(todayWIB());
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    roomId: "",
    date: date,
    startTime: "09:00",
    endTime: "10:00",
    department: "",
    title: "",
    recur: false,
    freq: "WEEKLY" as "WEEKLY" | "WEEKDAY" | "MONTHLY",
    weekdays: [] as number[],
    endMode: "date" as "date" | "count",
    untilDate: "",
    count: 8,
  });

  function toggleWeekday(v: number) {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(v)
        ? f.weekdays.filter((x) => x !== v)
        : [...f.weekdays, v],
    }));
  }

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meetings?date=${d}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  function openBooking() {
    setErr(null);
    const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
    setForm((f) => ({
      ...f,
      date,
      roomId: data?.rooms[0]?.id ?? "",
      title: "",
      recur: false,
      weekdays: [wd],
      endMode: "date",
      untilDate: "",
      count: 8,
    }));
    setOpen(true);
  }

  async function submit() {
    if (!form.roomId) return setErr("Pilih ruang");
    if (!form.title.trim()) return setErr("Isi deskripsi kegiatan");
    if (form.recur) {
      if (form.freq === "WEEKLY" && form.weekdays.length === 0)
        return setErr("Pilih minimal satu hari");
      if (form.endMode === "date" && !form.untilDate)
        return setErr("Isi tanggal berakhir");
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
          count: form.endMode === "count" ? Number(form.count) : undefined,
        };
      }
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) throw new Error(d.error ?? "Gagal booking");
      const skipped = (d.skipped?.length ?? 0) as number;
      toast(
        `${d.created ?? 1} pertemuan dipesan` +
          (skipped > 0 ? `, ${skipped} tanggal dilewati (bentrok)` : ""),
        "success"
      );
      setOpen(false);
      if (form.date !== date) setDate(form.date);
      else load(date);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function act(
    id: string,
    action: "checkin" | "cancel",
    scope?: "one" | "series"
  ) {
    if (action === "cancel") {
      const msg =
        scope === "series"
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
      toast(action === "checkin" ? "Check-in berhasil" : "Booking dibatalkan", "success");
      load(date);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusyId(null);
    }
  }

  const rooms = data?.rooms ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
          <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-1 hidden text-sm text-slate-500 sm:inline">
            {longDate(date)}
          </span>
        </div>
        <Button onClick={openBooking}>
          <Plus className="h-4 w-4" />
          Book Room Meeting
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const items = (data?.bookings ?? []).filter((b) => b.roomId === room.id);
            return (
              <Card key={room.id} className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-brand-600" />
                  <h3 className="font-semibold text-slate-800">{room.name}</h3>
                  <span className="ml-auto text-xs text-slate-400">
                    {items.length} jadwal
                  </span>
                </div>
                {items.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">
                    Belum ada jadwal. Ruang tersedia.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((b) => {
                      const mine = b.employeeId === data?.meId;
                      const start = new Date(b.startAt).getTime();
                      const now = Date.now();
                      const canCheckin =
                        mine &&
                        b.status === "BOOKED" &&
                        now >= start - GRACE_MS &&
                        now <= start + GRACE_MS;
                      return (
                        <div
                          key={b.id}
                          className="rounded-lg border border-slate-200 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium text-slate-800">
                                {hhmm(b.startAt)}–{hhmm(b.endAt)} · {b.title}
                                {b.seriesId && (
                                  <span title="Meeting berulang"> 🔁</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400">
                                {b.department ? `${b.department} · ` : ""}
                                {b.employeeName}
                              </div>
                            </div>
                            {b.status === "CHECKED_IN" ? (
                              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                Check-in
                              </Badge>
                            ) : (
                              <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                                Dipesan
                              </Badge>
                            )}
                          </div>
                          {mine && (b.status === "BOOKED" || b.status === "CHECKED_IN") && (
                            <div className="mt-2 flex gap-1">
                              {canCheckin && (
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => act(b.id, "checkin")}
                                  disabled={busyId === b.id}
                                >
                                  {busyId === b.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                  Check-in
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => act(b.id, "cancel", "one")}
                                disabled={busyId === b.id}
                              >
                                <X className="h-3.5 w-3.5" />
                                Batalkan
                              </Button>
                              {b.seriesId && (
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
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Book Room Meeting">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Ruang Rapat *</Label>
            <Select
              value={form.roomId}
              onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
            >
              <option value="">- Pilih ruang -</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tanggal *</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Jam Mulai *</Label>
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Jam Selesai *</Label>
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Divisi / Departemen</Label>
            <Input
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              placeholder="Kosongkan untuk pakai divisi Anda"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Deskripsi Kegiatan *</Label>
            <Textarea
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Agenda / topik meeting"
            />
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.recur}
                onChange={(e) => setForm((f) => ({ ...f, recur: e.target.checked }))}
              />
              Ulangi (meeting berulang)
            </label>

            {form.recur && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label>Pola</Label>
                  <Select
                    value={form.freq}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        freq: e.target.value as typeof f.freq,
                      }))
                    }
                  >
                    <option value="WEEKLY">Mingguan (pilih hari)</option>
                    <option value="WEEKDAY">Setiap hari kerja (Sen–Jum)</option>
                    <option value="MONTHLY">Bulanan (tanggal sama)</option>
                  </Select>
                </div>

                {form.freq === "WEEKLY" && (
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAYS.map((d) => (
                      <button
                        key={d.v}
                        type="button"
                        onClick={() => toggleWeekday(d.v)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                          form.weekdays.includes(d.v)
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {d.l}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Berakhir</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        checked={form.endMode === "date"}
                        onChange={() => setForm((f) => ({ ...f, endMode: "date" }))}
                      />
                      Sampai tanggal
                    </label>
                    <Input
                      type="date"
                      value={form.untilDate}
                      disabled={form.endMode !== "date"}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, untilDate: e.target.value }))
                      }
                      className="w-auto"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        checked={form.endMode === "count"}
                        onChange={() => setForm((f) => ({ ...f, endMode: "count" }))}
                      />
                      Jumlah pertemuan
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={form.count}
                      disabled={form.endMode !== "count"}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, count: Number(e.target.value) }))
                      }
                      className="w-24"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Book
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
