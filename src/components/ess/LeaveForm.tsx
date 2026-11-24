"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Loader2,
  X,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { LEAVE_TYPE_OPTIONS } from "@/lib/constants";
import { initials, workdayCount, cn } from "@/lib/utils";
import { fireConfetti } from "@/lib/confetti";

// ─── types ───────────────────────────────────────────────────────────────────

type Person = { id: string; name: string; jobTitle: string | null; hasEmail: boolean; hasPhone: boolean };
type SentInfo = { name: string; email: string | null; phone: string | null };
type LeaveBalance = { remaining: number; quota: number; used: number };
type FieldErrors = Partial<Record<string, string>>;

const emptyForm = {
  type: "ANNUAL" as string,
  startDate: "",
  endDate: "",
  isHalfDay: false,
  halfDaySession: "MORNING" as "MORNING" | "AFTERNOON",
  reason: "",
  task: "",
  substituteId: "",
  managerId: "",
};

const QUICK_CHIPS = ["Keperluan keluarga", "Liburan", "Urusan pribadi", "Istirahat"];

const LEAVE_CARD_META: Record<string, { sub: string }> = {
  ANNUAL: { sub: "Cuti berbayar tahunan" },
  SICK: { sub: "Sakit tanpa surat dokter" },
  SICK_CERTIFIED: { sub: "Sakit dengan surat dokter" },
};

// ─── OTP input (6 kotak) ─────────────────────────────────────────────────────

function OtpBoxes({
  value,
  onChange,
  hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  hasError: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  function set(idx: number, ch: string) {
    const arr = [...digits];
    arr[idx] = ch;
    onChange(arr.join(""));
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[idx]) {
        set(idx, "");
      } else if (idx > 0) {
        set(idx - 1, "");
        refs.current[idx - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      refs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < 5) {
      refs.current[idx + 1]?.focus();
    }
  }

  function handleChange(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const ch = e.target.value.replace(/\D/g, "").slice(-1);
    set(idx, ch);
    if (ch && idx < 5) refs.current[idx + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text) {
      const padded = text.padEnd(6, " ").slice(0, 6);
      onChange(padded.replace(/ /g, ""));
      const nextIdx = Math.min(text.length, 5);
      refs.current[nextIdx]?.focus();
    }
  }

  return (
    <div className="flex gap-2" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-12 w-10 rounded-xl border-[1.5px] text-center text-lg font-semibold tracking-widest outline-none",
            "transition-colors focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15",
            hasError && !d
              ? "border-red-400 bg-red-50"
              : "border-slate-200 bg-white"
          )}
        />
      ))}
    </div>
  );
}

// ─── person avatar chip ───────────────────────────────────────────────────────

function PersonChip({ info, role }: { info: SentInfo; role: string }) {
  const ini = initials(info.name);
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
        {ini}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800">{info.name}</p>
        <p className="text-xs text-slate-400">{role}</p>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function LeaveForm() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({ ...emptyForm });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [people, setPeople] = useState<Person[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [codeSub, setCodeSub] = useState("");
  const [codeMgr, setCodeMgr] = useState("");
  const [sentSub, setSentSub] = useState<SentInfo | null>(null);
  const [sentMgr, setSentMgr] = useState<SentInfo | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpTouched, setOtpTouched] = useState(false);
  const [successLeave, setSuccessLeave] = useState<{
    days: number;
    typeName: string;
    managerName: string;
    dateLabel: string;
  } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpen(true);
      router.replace("/leave");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/employees/substitutes")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPeople)
      .catch(() => setPeople([]));
    fetch("/api/leave/balance")
      .then((r) => (r.ok ? r.json() : null))
      .then(setBalance)
      .catch(() => setBalance(null));
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function reset() {
    setStep(1);
    setForm({ ...emptyForm });
    setFieldErrors({});
    setCodeSub("");
    setCodeMgr("");
    setSentSub(null);
    setSentMgr(null);
    setCooldown(0);
    setOtpError(null);
    setOtpTouched(false);
    setSuccessLeave(null);
  }
  function close() { setOpen(false); reset(); }

  // ─── computed duration ──────────────────────────────────────────────────────

  const durDays: number | null = (() => {
    if (form.isHalfDay) return 0.5;
    if (!form.startDate || !form.endDate) return null;
    const s = new Date(form.startDate);
    const e = new Date(form.endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return null;
    return workdayCount(s, e);
  })();

  const remainingAfter: number | null =
    form.type === "ANNUAL" && balance !== null && durDays !== null
      ? balance.remaining - durDays
      : null;

  // ─── OTP helpers ───────────────────────────────────────────────────────────

  async function sendOtpTo(recipientId: string, role: "substitute" | "manager"): Promise<SentInfo | null> {
    const res = await fetch("/api/leave/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId,
        role,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        isHalfDay: form.isHalfDay,
        halfDaySession: form.isHalfDay ? form.halfDaySession : undefined,
        reason: form.reason,
        task: form.task,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      setOtpError(data.error ?? "Gagal mengirim kode");
      return null;
    }
    return data.recipient as SentInfo;
  }

  async function sendBoth(): Promise<boolean> {
    setOtpError(null);
    const [s, m] = await Promise.all([
      sendOtpTo(form.substituteId, "substitute"),
      sendOtpTo(form.managerId, "manager"),
    ]);
    if (!s || !m) return false;
    setSentSub(s);
    setSentMgr(m);
    setCooldown(60);
    toast("Kode dikirim ke pengganti & Manager/Lead", "success");
    return true;
  }

  // ─── step 1 validation ─────────────────────────────────────────────────────

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (!form.startDate) errs.startDate = "Pilih tanggal mulai.";
    if (!form.isHalfDay && !form.endDate) errs.endDate = "Pilih tanggal selesai.";
    if (!form.substituteId) errs.substituteId = "Pilih karyawan pengganti.";
    if (!form.managerId) errs.managerId = "Pilih Manager/Lead.";
    if (form.managerId && form.managerId === form.substituteId)
      errs.managerId = "Manager/Lead tidak boleh sama dengan karyawan pengganti.";
    if (!form.reason.trim()) errs.reason = "Alasan cuti wajib diisi.";
    return errs;
  }

  function scrollToFirstError(errs: FieldErrors) {
    const first = Object.keys(errs)[0];
    const el = fieldRefs.current[first];
    if (el && bodyRef.current) {
      const top = el.getBoundingClientRect().top - bodyRef.current.getBoundingClientRect().top;
      bodyRef.current.scrollBy({ top: top - 32, behavior: "smooth" });
      setTimeout(() => {
        (el.querySelector("input,select,textarea") as HTMLElement | null)?.focus();
      }, 200);
    }
  }

  async function goStep2() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      scrollToFirstError(errs);
      return;
    }
    setFieldErrors({});
    setSending(true);
    try {
      if (await sendBoth()) setStep(2);
    } finally {
      setSending(false);
    }
  }

  async function resend() {
    if (cooldown > 0) return;
    setSending(true);
    try { await sendBoth(); } finally { setSending(false); }
  }

  // ─── step 2 submit ─────────────────────────────────────────────────────────

  async function submit() {
    setOtpTouched(true);
    if (codeSub.replace(/ /g, "").length < 6 || codeMgr.replace(/ /g, "").length < 6) {
      setOtpError("Masukkan kedua kode konfirmasi (6 digit).");
      return;
    }
    setSubmitting(true);
    setOtpError(null);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          substituteCode: codeSub.replace(/ /g, ""),
          managerCode: codeMgr.replace(/ /g, ""),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Gagal mengajukan");

      const typeName = LEAVE_TYPE_OPTIONS[form.type] ?? form.type;
      const mgr = people.find((p) => p.id === form.managerId);
      const dateLabel = form.isHalfDay || form.startDate === form.endDate
        ? form.startDate
        : `${form.startDate} – ${form.endDate}`;
      setSuccessLeave({
        days: durDays ?? 0,
        typeName,
        managerName: sentMgr?.name ?? mgr?.name ?? "Manager/Lead",
        dateLabel,
      });
      setStep(3);
      fireConfetti();
      router.refresh();
    } catch (e) {
      setOtpError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const managerOptions = people.filter((p) => p.id !== form.substituteId);
  const substituteOptions = people.filter((p) => p.id !== form.managerId);

  // ─── field helpers ─────────────────────────────────────────────────────────

  function FieldError({ name }: { name: string }) {
    const msg = fieldErrors[name];
    if (!msg) return null;
    return <p className="mt-1 text-xs text-red-600">{msg}</p>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setFieldRef(name: string): React.RefCallback<any> {
    return (el) => { fieldRefs.current[name] = el; };
  }

  function clearErr(name: string) {
    if (fieldErrors[name]) setFieldErrors((p) => { const n = { ...p }; delete n[name]; return n; });
  }

  // ─── render ────────────────────────────────────────────────────────────────

  if (!mounted) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Ajukan Cuti
      </Button>
    );
  }

  const modal = open ? (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

      <div className="relative z-10 flex w-full max-w-[560px] flex-col bg-white shadow-2xl rounded-t-[22px] sm:rounded-[22px] max-h-[95dvh] sm:max-h-[90vh]">

        {/* sticky header */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Ajukan Cuti</h2>
              {step < 3 && (
                <p className="mt-0.5 text-xs text-slate-500">Langkah {step} dari 2</p>
              )}
            </div>
            <button
              onClick={close}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {step < 3 && (
            <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 motion-reduce:transition-none transition-all duration-500"
                style={{ width: step === 1 ? "50%" : "100%" }}
              />
            </div>
          )}
        </div>

        {/* scrollable body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ═══ STEP 1 ═══ */}
          {step === 1 && (
            <>
              {/* Jenis cuti — kartu */}
              <div>
                <Label className="mb-2 block">Jenis Cuti</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {Object.entries(LEAVE_TYPE_OPTIONS).map(([v, label]) => {
                    const meta = LEAVE_CARD_META[v];
                    const active = form.type === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, type: v }))}
                        className={cn(
                          "rounded-xl border-[1.5px] p-3 text-left transition-colors outline-none",
                          "focus-visible:ring-4 focus-visible:ring-brand-500/20",
                          active
                            ? "border-brand-500 bg-brand-50 ring-4 ring-brand-500/10"
                            : "border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <p className="text-sm font-medium text-slate-800">{label}</p>
                        {meta && (
                          <p className="mt-0.5 text-xs text-slate-500 leading-tight">{meta.sub}</p>
                        )}
                        {v === "ANNUAL" && balance !== null && (
                          <p className={cn(
                            "mt-1.5 text-xs font-semibold",
                            balance.remaining > 0 ? "text-emerald-600" : "text-red-500"
                          )}>
                            Sisa {balance.remaining} hari
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggle setengah hari */}
              <div className="rounded-xl border-[1.5px] border-slate-200 p-3.5">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-brand-500"
                    checked={form.isHalfDay}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        isHalfDay: e.target.checked,
                        endDate: e.target.checked ? p.startDate : p.endDate,
                      }))
                    }
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Cuti Setengah Hari</p>
                    <p className="text-xs text-slate-400">Hanya menghitung 0,5 hari dari saldo</p>
                  </div>
                </label>
                {form.isHalfDay && (
                  <div className="mt-3 flex gap-4 pl-7">
                    {(["MORNING", "AFTERNOON"] as const).map((s) => (
                      <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          checked={form.halfDaySession === s}
                          onChange={() => setForm((p) => ({ ...p, halfDaySession: s }))}
                          className="accent-brand-500"
                        />
                        {s === "MORNING" ? "Pagi (08:00–12:00)" : "Siang (13:00–17:00)"}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Tanggal */}
              <div
                ref={setFieldRef("startDate")}
                className={cn("grid gap-3", form.isHalfDay ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}
              >
                <div className="space-y-1.5">
                  <Label>{form.isHalfDay ? "Tanggal *" : "Tanggal Mulai *"}</Label>
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={form.startDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((p) => ({
                        ...p,
                        startDate: v,
                        endDate: p.isHalfDay ? v : (p.endDate && p.endDate < v ? v : p.endDate),
                      }));
                      clearErr("startDate");
                    }}
                    className={cn(
                      "h-12 w-full rounded-xl border-[1.5px] bg-white px-3.5 text-sm outline-none",
                      "transition-colors focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15",
                      fieldErrors.startDate ? "border-red-400" : "border-slate-200"
                    )}
                  />
                  <FieldError name="startDate" />
                </div>
                {!form.isHalfDay && (
                  <div className="space-y-1.5" ref={setFieldRef("endDate")}>
                    <Label>Tanggal Selesai *</Label>
                    <input
                      type="date"
                      min={form.startDate || new Date().toISOString().slice(0, 10)}
                      value={form.endDate}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, endDate: e.target.value }));
                        clearErr("endDate");
                      }}
                      className={cn(
                        "h-12 w-full rounded-xl border-[1.5px] bg-white px-3.5 text-sm outline-none",
                        "transition-colors focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15",
                        fieldErrors.endDate ? "border-red-400" : "border-slate-200"
                      )}
                    />
                    <FieldError name="endDate" />
                  </div>
                )}
              </div>

              {/* Ringkasan durasi */}
              {durDays !== null && (
                <div className={cn(
                  "rounded-xl border-[1.5px] px-4 py-3 text-sm",
                  remainingAfter !== null && remainingAfter < 0
                    ? "border-amber-200 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50"
                )}>
                  <p className={cn(
                    "font-medium",
                    remainingAfter !== null && remainingAfter < 0 ? "text-amber-700" : "text-emerald-700"
                  )}>
                    {form.isHalfDay ? "0,5 hari kerja" : `${durDays} hari kerja`}
                    {form.type === "ANNUAL" && remainingAfter !== null && (
                      <>
                        {" · "}
                        {remainingAfter < 0
                          ? `melebihi saldo ${Math.abs(remainingAfter)} hari`
                          : `sisa saldo menjadi ${remainingAfter} hari`}
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Pengganti & Manager */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5" ref={setFieldRef("substituteId")}>
                  <Label>Karyawan Pengganti *</Label>
                  <select
                    value={form.substituteId}
                    onChange={(e) => { setForm((p) => ({ ...p, substituteId: e.target.value })); clearErr("substituteId"); }}
                    className={cn(
                      "h-12 w-full rounded-xl border-[1.5px] bg-white px-3.5 text-sm outline-none",
                      "transition-colors focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15",
                      fieldErrors.substituteId ? "border-red-400" : "border-slate-200"
                    )}
                  >
                    <option value="">— Pilih karyawan —</option>
                    {substituteOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.jobTitle ? ` — ${s.jobTitle}` : ""}
                      </option>
                    ))}
                  </select>
                  <FieldError name="substituteId" />
                </div>

                <div className="space-y-1.5" ref={setFieldRef("managerId")}>
                  <Label>Manager / Lead *</Label>
                  <select
                    value={form.managerId}
                    onChange={(e) => { setForm((p) => ({ ...p, managerId: e.target.value })); clearErr("managerId"); }}
                    className={cn(
                      "h-12 w-full rounded-xl border-[1.5px] bg-white px-3.5 text-sm outline-none",
                      "transition-colors focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15",
                      fieldErrors.managerId ? "border-red-400" : "border-slate-200"
                    )}
                  >
                    <option value="">— Pilih Manager/Lead —</option>
                    {managerOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.jobTitle ? ` — ${s.jobTitle}` : ""}
                      </option>
                    ))}
                  </select>
                  <FieldError name="managerId" />
                </div>
              </div>

              {/* Alasan cuti */}
              <div className="space-y-1.5" ref={setFieldRef("reason")}>
                <div className="flex items-center justify-between">
                  <Label>Alasan Cuti *</Label>
                  <span className={cn("text-xs", form.reason.length > 190 ? "text-amber-600" : "text-slate-400")}>
                    {form.reason.length}/200
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CHIPS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setForm((p) => ({ ...p, reason: c })); clearErr("reason"); }}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                        form.reason === c
                          ? "border-brand-400 bg-brand-50 text-brand-700"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={form.reason}
                  maxLength={200}
                  onChange={(e) => { setForm((p) => ({ ...p, reason: e.target.value })); clearErr("reason"); }}
                  placeholder="Alasan pengajuan cuti"
                  className={cn(fieldErrors.reason && "border-red-400")}
                />
                <FieldError name="reason" />
              </div>

              {/* Hand-over */}
              <div className="space-y-1.5">
                <Label>
                  Tugas / Hand-over{" "}
                  <span className="font-normal text-slate-400">(opsional)</span>
                </Label>
                <Textarea
                  value={form.task}
                  onChange={(e) => setForm((p) => ({ ...p, task: e.target.value }))}
                  placeholder="Tugas yang diserahkan ke pengganti selama cuti"
                />
              </div>

              {/* Info box */}
              <div className="flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-700">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <span>
                  Langkah berikutnya: kode konfirmasi 6 digit akan dikirim ke email &amp;
                  WhatsApp <strong>karyawan pengganti</strong> dan{" "}
                  <strong>Manager/Lead</strong> yang Anda pilih. Kode berlaku{" "}
                  <strong>30 menit</strong>.
                </span>
              </div>
            </>
          )}

          {/* ═══ STEP 2 ═══ */}
          {step === 2 && (
            <>
              <p className="text-sm text-slate-600">
                Masukkan kode 6 digit yang sudah dikirim ke masing-masing penerima.
              </p>

              <div className="space-y-2">
                {sentSub && <PersonChip info={sentSub} role="Karyawan Pengganti" />}
                <OtpBoxes
                  value={codeSub}
                  onChange={(v) => { setCodeSub(v); if (otpError) setOtpError(null); }}
                  hasError={otpTouched && codeSub.replace(/ /g, "").length < 6}
                />
              </div>

              <div className="space-y-2">
                {sentMgr && <PersonChip info={sentMgr} role="Manager / Lead" />}
                <OtpBoxes
                  value={codeMgr}
                  onChange={(v) => { setCodeMgr(v); if (otpError) setOtpError(null); }}
                  hasError={otpTouched && codeMgr.replace(/ /g, "").length < 6}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Kode berlaku 30 menit.</span>
                <button
                  type="button"
                  onClick={resend}
                  disabled={cooldown > 0 || sending}
                  className="flex items-center gap-1 font-medium text-brand-700 disabled:text-slate-400 transition-colors"
                >
                  {sending
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <RefreshCw className="h-3 w-3" />
                  }
                  {cooldown > 0 ? `Kirim ulang (${cooldown}s)` : "Kirim ulang kode"}
                </button>
              </div>

              {otpError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {otpError}
                </div>
              )}
            </>
          )}

          {/* ═══ STEP 3: sukses ═══ */}
          {step === 3 && successLeave && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Pengajuan Terkirim!</h3>
              <p className="mt-2 text-sm text-slate-600">
                {successLeave.typeName}{" "}
                <strong>
                  {successLeave.days === 0.5 ? "½ hari" : `${successLeave.days} hari`}
                </strong>{" "}
                ({successLeave.dateLabel})
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Menunggu persetujuan <strong>{successLeave.managerName}</strong> dan HR.
              </p>
            </div>
          )}
        </div>

        {/* sticky footer */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4">
          {step === 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={close} className="shrink-0">
                Batal
              </Button>
              <Button onClick={goStep2} disabled={sending} className="flex-1 sm:flex-none">
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                Lanjut &amp; Kirim Kode
              </Button>
            </div>
          )}
          {step === 2 && (
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep(1)} className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </Button>
              <Button onClick={submit} disabled={submitting} className="flex-1 sm:flex-none">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Memverifikasi…" : "Verifikasi & Kirim"}
              </Button>
            </div>
          )}
          {step === 3 && (
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={close}>Tutup</Button>
              <Button onClick={reset}>Ajukan lagi</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Ajukan Cuti
      </Button>
      {createPortal(modal ?? <></>, document.body)}
    </>
  );
}
