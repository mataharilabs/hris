"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";

export function SalaryForm({
  employeeId,
  initialSalary,
  initialQuota,
  initialRemaining,
}: {
  employeeId: string;
  initialSalary: number | null;
  initialQuota: number;
  initialRemaining: number;
}) {
  const [salary, setSalary] = useState(
    initialSalary != null ? String(initialSalary) : ""
  );
  const [quota, setQuota] = useState(String(initialQuota));
  const [remaining, setRemaining] = useState(String(initialRemaining));
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlySalary: salary === "" ? null : Number(salary),
          leaveQuota: Number(quota),
          remaining: remaining === "" ? undefined : Number(remaining),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Gagal menyimpan");
      toast("Data HRIS diperbarui", "success");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Gaji Bulanan (IDR)</Label>
        <Input
          type="number"
          value={salary}
          onChange={(e) => setSalary(e.target.value)}
          placeholder="mis. 8000000"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Kuota Cuti Tahunan (hari)</Label>
        <Input
          type="number"
          value={quota}
          onChange={(e) => setQuota(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Sisa Cuti Tahunan (hari)</Label>
        <Input
          type="number"
          value={remaining}
          onChange={(e) => setRemaining(e.target.value)}
        />
        <p className="text-xs text-slate-400">
          Set manual sisa cuti saat ini. Cuti yang diajukan tetap memotong sisa ini.
        </p>
      </div>
      <Button onClick={save} disabled={saving} className="w-full">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Simpan
      </Button>
    </div>
  );
}
