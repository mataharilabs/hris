"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { REIMBURSEMENT_CATEGORIES } from "@/lib/constants";

export function ReimbursementForm() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: REIMBURSEMENT_CATEGORIES[0],
    title: "",
    amount: "",
    spentAt: "",
    description: "",
  });
  const router = useRouter();

  async function submit() {
    if (!form.title || !form.amount || !form.spentAt) {
      toast("Lengkapi judul, jumlah, dan tanggal", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/reimbursement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Gagal mengajukan");
      toast("Pengajuan reimbursement terkirim", "success");
      setOpen(false);
      setForm({
        category: REIMBURSEMENT_CATEGORIES[0],
        title: "",
        amount: "",
        spentAt: "",
        description: "",
      });
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Ajukan Reimbursement
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Ajukan Reimbursement"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select
                value={form.category}
                onChange={(e) =>
                  setForm((p) => ({ ...p, category: e.target.value }))
                }
              >
                {REIMBURSEMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Pengeluaran</Label>
              <Input
                type="date"
                value={form.spentAt}
                onChange={(e) =>
                  setForm((p) => ({ ...p, spentAt: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Judul</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="mis. Taksi ke bandara"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Jumlah (IDR)</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) =>
                setForm((p) => ({ ...p, amount: e.target.value }))
              }
              placeholder="mis. 150000"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Keterangan (opsional)</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Kirim
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
