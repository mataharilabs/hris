"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";

type Person = {
  id: string;
  name: string;
  jobTitle: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
};

type SentInfo = { name: string; email: string | null; phone: string | null };

const emptyForm = {
  type: "ANNUAL",
  startDate: "",
  endDate: "",
  reason: "",
  task: "",
  substituteId: "",
  managerId: "",
};

export function LeaveForm() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ ...emptyForm });
  const [people, setPeople] = useState<Person[]>([]);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [codeSub, setCodeSub] = useState("");
  const [codeMgr, setCodeMgr] = useState("");
  const [sentSub, setSentSub] = useState<SentInfo | null>(null);
  const [sentMgr, setSentMgr] = useState<SentInfo | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

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
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function reset() {
    setStep(1);
    setForm({ ...emptyForm });
    setCodeSub("");
    setCodeMgr("");
    setSentSub(null);
    setSentMgr(null);
    setCooldown(0);
    setErr(null);
  }
  function close() {
    setOpen(false);
    reset();
  }

  // Kirim OTP ke satu penerima; kembalikan info penerima atau null bila gagal.
  async function sendOtpTo(
    recipientId: string,
    role: "substitute" | "manager"
  ): Promise<SentInfo | null> {
    const res = await fetch("/api/leave/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId,
        role,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason,
        task: form.task,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      setErr(data.error ?? "Gagal mengirim kode");
      return null;
    }
    return data.recipient as SentInfo;
  }

  async function sendBoth(): Promise<boolean> {
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

  async function goStep2() {
    if (!form.substituteId) return setErr("Pilih karyawan pengganti");
    if (!form.managerId) return setErr("Pilih Manager/Lead");
    if (form.managerId === form.substituteId)
      return setErr("Manager/Lead tidak boleh sama dengan karyawan pengganti");
    if (!form.startDate || !form.endDate)
      return setErr("Isi tanggal mulai & selesai");
    if (!form.reason.trim()) return setErr("Alasan cuti wajib diisi");
    setErr(null);
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
    try {
      await sendBoth();
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    if (!codeSub.trim() || !codeMgr.trim()) {
      toast("Masukkan kedua kode konfirmasi", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          substituteCode: codeSub,
          managerCode: codeMgr,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Gagal mengajukan");
      toast("Pengajuan cuti terkirim, menunggu persetujuan HR", "success");
      close();
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  const managerOptions = people.filter((p) => p.id !== form.substituteId);
  const substituteOptions = people.filter((p) => p.id !== form.managerId);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Ajukan Cuti
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={step === 1 ? "Ajukan Cuti — Langkah 1/2" : "Ajukan Cuti — Langkah 2/2"}
      >
        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Jenis Cuti</Label>
              <Select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              >
                {Object.entries(LEAVE_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tanggal Mulai *</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, startDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal Selesai *</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, endDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Karyawan Pengganti *</Label>
              <Select
                value={form.substituteId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, substituteId: e.target.value }))
                }
              >
                <option value="">- Pilih karyawan -</option>
                {substituteOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.jobTitle ? ` — ${s.jobTitle}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Manager / Lead *</Label>
              <Select
                value={form.managerId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, managerId: e.target.value }))
                }
              >
                <option value="">- Pilih Manager/Lead -</option>
                {managerOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.jobTitle ? ` — ${s.jobTitle}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Alasan Cuti *</Label>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Alasan pengajuan cuti"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tugas / hand-over (opsional)</Label>
              <Textarea
                value={form.task}
                onChange={(e) => setForm((p) => ({ ...p, task: e.target.value }))}
                placeholder="Tugas yang diserahkan ke pengganti selama cuti"
              />
            </div>

            {err && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {err}
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Langkah berikutnya: masukkan 2 kode konfirmasi yang dikirim ke email
              &amp; WhatsApp <strong>karyawan pengganti</strong> dan{" "}
              <strong>Manager/Lead</strong>.
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={close}>
                Batal
              </Button>
              <Button onClick={goStep2} disabled={sending}>
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                Lanjut &amp; Kirim Kode
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Kode Karyawan Pengganti</Label>
              {sentSub && (
                <p className="text-xs text-slate-400">
                  Dikirim ke {sentSub.name}
                  {sentSub.email ? ` · ${sentSub.email}` : ""}
                  {sentSub.phone ? ` · WA ${sentSub.phone}` : ""}
                </p>
              )}
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="6 digit"
                value={codeSub}
                onChange={(e) => setCodeSub(e.target.value.replace(/\D/g, ""))}
                className="tracking-widest"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Kode Manager / Lead</Label>
              {sentMgr && (
                <p className="text-xs text-slate-400">
                  Dikirim ke {sentMgr.name}
                  {sentMgr.email ? ` · ${sentMgr.email}` : ""}
                  {sentMgr.phone ? ` · WA ${sentMgr.phone}` : ""}
                </p>
              )}
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="6 digit"
                value={codeMgr}
                onChange={(e) => setCodeMgr(e.target.value.replace(/\D/g, ""))}
                className="tracking-widest"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Kedua kode berlaku 5 menit.</span>
              <button
                type="button"
                onClick={resend}
                disabled={cooldown > 0 || sending}
                className="font-medium text-brand-700 disabled:text-slate-400"
              >
                {cooldown > 0 ? `Kirim ulang (${cooldown}s)` : "Kirim ulang kode"}
              </button>
            </div>

            <div className="flex justify-between gap-2 pt-1">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Ajukan Cuti
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
