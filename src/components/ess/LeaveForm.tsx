"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";

type Substitute = {
  id: string;
  name: string;
  jobTitle: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
};

type SentInfo = {
  name: string;
  email: string | null;
  phone: string | null;
};

const emptyForm = {
  type: "ANNUAL",
  startDate: "",
  endDate: "",
  reason: "",
  task: "",
  substituteId: "",
};

export function LeaveForm() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ ...emptyForm });
  const [subs, setSubs] = useState<Substitute[]>([]);
  const [sending, setSending] = useState(false); // kirim OTP (step 1 → 2)
  const [submitting, setSubmitting] = useState(false); // ajukan (step 2)
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<SentInfo | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Buka otomatis bila diarahkan dari shortcut (?new=1).
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpen(true);
      router.replace("/leave");
    }
  }, [searchParams, router]);

  // Ambil daftar pengganti saat dialog dibuka.
  useEffect(() => {
    if (!open) return;
    fetch("/api/employees/substitutes")
      .then((r) => (r.ok ? r.json() : []))
      .then(setSubs)
      .catch(() => setSubs([]));
  }, [open]);

  // Hitung mundur cooldown resend.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function reset() {
    setStep(1);
    setForm({ ...emptyForm });
    setCode("");
    setSent(null);
    setCooldown(0);
    setErr(null);
  }
  function close() {
    setOpen(false);
    reset();
  }

  async function sendOtp(): Promise<boolean> {
    const res = await fetch("/api/leave/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        substituteId: form.substituteId,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason,
        task: form.task,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      const m = data.error ?? "Gagal mengirim kode";
      setErr(m);
      toast(m, "error");
      return false;
    }
    const ch = [data.sentEmail && "email", data.sentWhatsapp && "WhatsApp"]
      .filter(Boolean)
      .join(" & ");
    setSent(data.substitute);
    setCooldown(60);
    toast(`Kode dikirim via ${ch}`, "success");
    return true;
  }

  async function goStep2() {
    if (!form.substituteId) {
      setErr("Pilih karyawan pengganti");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setErr("Isi tanggal mulai & selesai");
      return;
    }
    if (!form.reason.trim()) {
      setErr("Alasan cuti wajib diisi");
      return;
    }
    setErr(null);
    setSending(true);
    try {
      if (await sendOtp()) setStep(2);
    } finally {
      setSending(false);
    }
  }

  async function resend() {
    if (cooldown > 0) return;
    setSending(true);
    try {
      await sendOtp();
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    if (!code.trim()) {
      toast("Masukkan kode konfirmasi", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, code }),
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

  const selectedSub = subs.find((s) => s.id === form.substituteId);

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
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.jobTitle ? ` — ${s.jobTitle}` : ""}
                  </option>
                ))}
              </Select>
              {selectedSub && !selectedSub.hasEmail && !selectedSub.hasPhone && (
                <p className="text-xs text-red-500">
                  Karyawan ini tidak punya email/WhatsApp untuk menerima kode.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Alasan Cuti *</Label>
              <Textarea
                value={form.reason}
                onChange={(e) =>
                  setForm((p) => ({ ...p, reason: e.target.value }))
                }
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
              Langkah berikutnya: masukkan kode konfirmasi yang dikirim ke email &amp;
              WhatsApp karyawan pengganti.
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
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              Kode konfirmasi dikirim ke{" "}
              <strong>{sent?.name}</strong>
              {sent?.email ? ` · email ${sent.email}` : ""}
              {sent?.phone ? ` · WA ${sent.phone}` : ""}.
            </div>
            <div className="space-y-1.5">
              <Label>Kode Konfirmasi</Label>
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="6 digit"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="tracking-widest"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Berlaku 5 menit.</span>
                <button
                  type="button"
                  onClick={resend}
                  disabled={cooldown > 0 || sending}
                  className="font-medium text-brand-700 disabled:text-slate-400"
                >
                  {cooldown > 0 ? `Kirim ulang (${cooldown}s)` : "Kirim ulang kode"}
                </button>
              </div>
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
