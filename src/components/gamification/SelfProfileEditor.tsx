"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, Check, X } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { formatDate } from "@/lib/utils";
import { refreshGami } from "./GamificationBar";

type Props = {
  birthDate: string | null; // ISO
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
};

function isoToInput(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(iso)
  );
}

export function SelfProfileEditor(props: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    birthDate: isoToInput(props.birthDate),
    emergencyName: props.emergencyName ?? "",
    emergencyRelation: props.emergencyRelation ?? "",
    emergencyPhone: props.emergencyPhone ?? "",
  });
  const router = useRouter();

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/self", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) throw new Error(d.error ?? "Gagal menyimpan");
      toast("Data diri diperbarui", "success");
      setEditing(false);
      refreshGami();
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  function Row({ label, value }: { label: string; value?: string | null }) {
    return (
      <div className="flex justify-between gap-4 border-b border-slate-50 py-2 text-sm last:border-0">
        <span className="text-slate-400">{label}</span>
        <span className="text-right font-medium text-slate-800">{value || "-"}</span>
      </div>
    );
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Data Diri</h3>
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
        <Row
          label="Tanggal Lahir"
          value={props.birthDate ? formatDate(props.birthDate) : null}
        />
        <Row label="Kontak Darurat" value={props.emergencyName} />
        <Row label="Hubungan" value={props.emergencyRelation} />
        <Row label="Telepon Darurat" value={props.emergencyPhone} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-slate-900">Edit Data Diri</h3>
      <div className="space-y-1.5">
        <Label>Tanggal Lahir</Label>
        <Input
          type="date"
          value={form.birthDate}
          onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Nama Kontak Darurat</Label>
          <Input
            value={form.emergencyName}
            onChange={(e) =>
              setForm((f) => ({ ...f, emergencyName: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Hubungan</Label>
          <Input
            value={form.emergencyRelation}
            onChange={(e) =>
              setForm((f) => ({ ...f, emergencyRelation: e.target.value }))
            }
            placeholder="mis. Orang tua"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Telepon Darurat</Label>
          <Input
            value={form.emergencyPhone}
            onChange={(e) =>
              setForm((f) => ({ ...f, emergencyPhone: e.target.value }))
            }
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
          <X className="h-4 w-4" />
          Batal
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Simpan
        </Button>
      </div>
    </div>
  );
}
