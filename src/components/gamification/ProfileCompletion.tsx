"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gift,
  Loader2,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { refreshGami } from "./GamificationBar";
import { fireConfetti } from "@/lib/confetti";

type StepKey = "birthDate" | "emergency" | "photo" | "kudos";

const STEPS: { key: StepKey; label: string; time: string; reason: string; points: number }[] = [
  { key: "birthDate", label: "Tanggal lahir", time: "~1 menit", reason: "Dipakai untuk ucapan ulang tahun di Kudos Wall.", points: 5 },
  { key: "emergency", label: "Kontak darurat", time: "~2 menit", reason: "Hanya dihubungi HR saat keadaan darurat.", points: 5 },
  { key: "photo", label: "Foto profil", time: "~1 menit", reason: "Membantu rekan mengenali Anda di HRIS.", points: 5 },
  { key: "kudos", label: "Kirim kudos pertama", time: "~2 menit", reason: "Mulai budaya apresiasi di tim Anda.", points: 25 },
];

const RELATIONS = ["Pasangan", "Orang tua", "Saudara", "Teman", "Lainnya"];

const KUDOS_TEMPLATES = [
  "Terima kasih atas bantuanmu selama ini! 🙌",
  "Kamu selalu bisa diandalkan! 💪",
  "Semangatmu menginspirasi kami semua! ⭐",
  "Kerja keras kamu sangat berarti! 🎉",
];

type Coworker = { id: string; name: string; jobTitle: string | null };

async function imageToSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gagal memuat gambar")); };
    img.src = url;
  });
}

// --- sub-forms ---

function BirthDateForm({ initial, onDone }: { initial: string | null; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const initVal = initial ? new Date(initial).toISOString().slice(0, 10) : "";
  const [value, setValue] = useState(initVal);
  const [busy, setBusy] = useState(false);
  const valid = !!value && value <= today;

  async function save() {
    if (!valid) return;
    setBusy(true);
    try {
      const res = await fetch("/api/profile/self", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate: value }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast(d.error ?? "Gagal menyimpan", "error"); return; }
      toast("Tanggal lahir tersimpan · +5 poin ✓", "success");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="date"
        value={value}
        max={today}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
      />
      {value && value > today && (
        <p className="text-xs text-red-500">Tanggal tidak boleh di masa depan.</p>
      )}
      <SaveButton disabled={!valid || busy} busy={busy} onClick={save} />
    </div>
  );
}

function EmergencyForm({
  initial,
  onDone,
}: {
  initial: { name: string | null; relation: string | null; phone: string | null };
  onDone: () => void;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [relation, setRelation] = useState(initial.relation ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [busy, setBusy] = useState(false);
  const phoneValid = /^[0-9+\s\-]{6,20}$/.test(phone.trim());
  const canSave = !!name.trim() && !!relation && phoneValid;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      const res = await fetch("/api/profile/self", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emergencyName: name.trim(), emergencyRelation: relation, emergencyPhone: phone.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast(d.error ?? "Gagal menyimpan", "error"); return; }
      toast("Kontak darurat tersimpan · +5 poin ✓", "success");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama kontak darurat"
        className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
      />
      <select
        value={relation}
        onChange={(e) => setRelation(e.target.value)}
        className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
      >
        <option value="">Hubungan</option>
        {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Nomor telepon (cth. 08123456789)"
        className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
      />
      {phone && !phoneValid && (
        <p className="text-xs text-red-500">Nomor telepon tidak valid (min. 6 angka).</p>
      )}
      <SaveButton disabled={!canSave || busy} busy={busy} onClick={save} />
    </div>
  );
}

function PhotoForm({
  initial,
  name,
  onDone,
}: {
  initial: string | null;
  name: string;
  onDone: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Hanya JPG/PNG", "error"); return; }
    try {
      const dataUrl = await imageToSquareDataUrl(file);
      if (dataUrl.length > 400_000) { toast("Foto terlalu besar (maks ~300KB)", "error"); return; }
      setPreview(dataUrl);
    } catch {
      toast("Gagal memuat gambar", "error");
    }
    // reset input so same file can be re-picked
    e.target.value = "";
  }

  async function save() {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await fetch("/api/profile/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: preview }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast(d.error ?? "Gagal menyimpan", "error"); return; }
      toast("Foto profil tersimpan · +5 poin ✓", "success");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const displayPhoto = preview ?? initial;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-slate-50 hover:border-brand-400 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {displayPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayPhoto} alt={name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xl font-bold text-slate-400">{(name[0] ?? "?").toUpperCase()}</span>
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-[8px] border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {displayPhoto ? "Ganti foto" : "Pilih foto"}
          </button>
          <p className="mt-1 text-[11px] text-slate-400">JPG atau PNG · dipangkas persegi</p>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
      <SaveButton
        label="Simpan foto"
        disabled={!preview || busy}
        busy={busy}
        onClick={save}
      />
    </div>
  );
}

function KudosForm({ onDone }: { onDone: () => void }) {
  const [coworkers, setCoworkers] = useState<Coworker[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipientId, setRecipientId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const MAX = 50;
  const canSend = !!recipientId && message.trim().length > 0 && message.trim().length <= MAX;

  useEffect(() => {
    fetch("/api/employees/coworkers")
      .then((r) => r.json())
      .then((d) => setCoworkers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function send() {
    if (!canSend) return;
    setBusy(true);
    try {
      const res = await fetch("/api/kudos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, message: message.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast(d.error ?? "Gagal mengirim kudos", "error"); return; }
      toast("Kudos terkirim · +25 poin ✓", "success");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <select
        value={recipientId}
        onChange={(e) => setRecipientId(e.target.value)}
        className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
      >
        <option value="">Pilih rekan kerja</option>
        {coworkers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}{c.jobTitle ? ` · ${c.jobTitle}` : ""}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap gap-1.5">
        {KUDOS_TEMPLATES.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setMessage(t)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
              message === t
                ? "border-brand-400 bg-brand-50 text-brand-700"
                : "border-slate-200 text-slate-500 hover:border-brand-300"
            )}
          >
            Template {i + 1}
          </button>
        ))}
      </div>

      <div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tulis pesan apresiasi..."
          rows={2}
          maxLength={MAX}
          className="w-full resize-none rounded-[10px] border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
        />
        <div className={cn("text-right text-[11px] tabular-nums", message.length > MAX ? "text-red-500" : "text-slate-400")}>
          {message.length}/{MAX}
        </div>
      </div>

      <SaveButton label="Kirim kudos" disabled={!canSend || busy} busy={busy} onClick={send} />
    </div>
  );
}

function SaveButton({ label = "Simpan", disabled, busy, onClick }: {
  label?: string;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#D6194B] text-sm font-bold text-white transition-colors hover:bg-[#B01239] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : label}
    </button>
  );
}

// --- main component ---

type Props = {
  initialDone: { birthDate: boolean; emergency: boolean; photo: boolean; kudos: boolean };
  initialClaimed: boolean;
  birthDate: string | null;
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
  photo: string | null;
  name: string;
};

export function ProfileCompletion({
  initialDone,
  initialClaimed,
  birthDate: initBirthDate,
  emergencyName: initEmerName,
  emergencyRelation: initEmerRel,
  emergencyPhone: initEmerPhone,
  photo: initPhoto,
  name,
}: Props) {
  const router = useRouter();
  const [done, setDone] = useState(initialDone);
  const [claimed, setClaimed] = useState(initialClaimed);
  const [open, setOpen] = useState<StepKey | null>(() => {
    for (const s of STEPS) if (!initialDone[s.key]) return s.key;
    return null;
  });
  const [claimBusy, setClaimBusy] = useState(false);

  if (claimed) return null;

  const doneCount = Object.values(done).filter(Boolean).length;
  const percent = Math.round(((1 + doneCount) / 5) * 100);
  const allDone = doneCount === 4;

  function markDone(key: StepKey) {
    const updated = { ...done, [key]: true };
    setDone(updated);
    const nextKey = STEPS.find((s) => !updated[s.key])?.key ?? null;
    setOpen(nextKey);
    refreshGami();
    router.refresh();
  }

  async function claimBonus() {
    setClaimBusy(true);
    try {
      const res = await fetch("/api/onboarding/claim", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) { toast(d.error ?? "Gagal klaim", "error"); return; }
      toast(`Profil lengkap! +${d.points} poin 🎉`, "success");
      setClaimed(true);
      refreshGami();
      fireConfetti();
    } finally {
      setClaimBusy(false);
    }
  }

  if (allDone) {
    return (
      <Card className="p-6 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl font-extrabold text-emerald-600">
          ✓
        </div>
        <h3 className="text-lg font-extrabold text-slate-900">Profil lengkap!</h3>
        <p className="mt-1 text-sm text-slate-500">
          Semua langkah selesai. Klaim bonus +25 poin Anda.
        </p>
        <button
          type="button"
          onClick={claimBonus}
          disabled={claimBusy}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#D6194B] text-sm font-bold text-white hover:bg-[#B01239] disabled:opacity-60"
        >
          {claimBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Gift className="h-4 w-4" /> Tutup kartu ini (+25 poin)</>}
        </button>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Header + progress */}
      <div className="flex items-center gap-3 border-b border-slate-100 p-4">
        <Trophy className="h-5 w-5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Lengkapi profil</h2>
            <span className="text-xs font-bold text-brand-700">{percent}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Auto step: akun dibuat */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        <span className="flex-1 text-sm text-slate-400 line-through">Akun dibuat</span>
        <span className="text-[11px] font-semibold text-emerald-600">Selesai</span>
      </div>

      {/* 4 manual steps */}
      {STEPS.map((step, idx) => {
        const isDone = done[step.key];
        const isOpen = open === step.key && !isDone;

        return (
          <div key={step.key} className="border-b border-slate-100 last:border-0">
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                isDone ? "cursor-default" : "hover:bg-slate-50/60"
              )}
              onClick={() => !isDone && setOpen(isOpen ? null : step.key)}
            >
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-[10px] font-bold text-slate-400">
                  {idx + 1}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm font-medium", isDone ? "text-slate-400 line-through" : "text-slate-800")}>
                  {step.label}
                </div>
                {!isDone && !isOpen && (
                  <div className="text-[11px] text-slate-400">{step.time} · {step.reason}</div>
                )}
              </div>
              <span className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                isDone ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              )}>
                +{step.points}
              </span>
              {!isDone && (
                isOpen
                  ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
                  : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
              )}
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 bg-slate-50/40 px-4 pb-4 pt-3">
                <p className="mb-3 text-xs text-slate-500">{step.reason}</p>
                {step.key === "birthDate" && (
                  <BirthDateForm initial={initBirthDate} onDone={() => markDone("birthDate")} />
                )}
                {step.key === "emergency" && (
                  <EmergencyForm
                    initial={{ name: initEmerName, relation: initEmerRel, phone: initEmerPhone }}
                    onDone={() => markDone("emergency")}
                  />
                )}
                {step.key === "photo" && (
                  <PhotoForm initial={initPhoto} name={name} onDone={() => markDone("photo")} />
                )}
                {step.key === "kudos" && (
                  <KudosForm onDone={() => markDone("kudos")} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}
