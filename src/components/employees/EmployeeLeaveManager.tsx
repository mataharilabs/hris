"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ess/StatusBadge";
import { toast } from "@/components/ui/toaster";
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_OPTIONS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export type LeaveRow = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  createdAt: string;
};

const emptyForm = { type: "ANNUAL", startDate: "", endDate: "", reason: "" };

export function EmployeeLeaveManager({
  employeeId,
  employeeName,
  leaves,
  canManage,
}: {
  employeeId: string;
  employeeName: string;
  leaves: LeaveRow[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function openEdit(l: LeaveRow) {
    setEditingId(l.id);
    setForm({
      type: l.type,
      startDate: l.startDate.slice(0, 10),
      endDate: l.endDate.slice(0, 10),
      reason: l.reason ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.startDate || !form.endDate) {
      toast("Isi tanggal mulai & selesai", "error");
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `/api/leave/${editingId}`
        : `/api/employees/${employeeId}/leave`;
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Gagal menyimpan");
      toast(editingId ? "Data cuti diperbarui" : "Data cuti ditambahkan", "success");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Hapus data cuti ini? Jatah cuti karyawan akan dikembalikan."))
      return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/leave/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Gagal menghapus");
      toast("Data cuti dihapus", "success");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Pengajuan Cuti Karyawan</CardTitle>
          <p className="text-xs text-slate-400">
            Riwayat cuti yang sudah disetujui.
          </p>
        </div>
        {canManage && (
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4" />
            Add Data Cuti Manual
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {leaves.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            Belum ada cuti yang disetujui.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jenis</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Hari</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{LEAVE_TYPE_LABELS[l.type] ?? l.type}</TableCell>
                  <TableCell className="text-sm">
                    {formatDate(l.startDate)} – {formatDate(l.endDate)}
                  </TableCell>
                  <TableCell>{l.days}</TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm text-slate-500">
                    {l.reason ?? "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={l.status} />
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(l)}
                          title="Edit data cuti"
                          className="inline-flex items-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(l.id)}
                          disabled={deletingId === l.id}
                          title="Hapus data cuti"
                          className="inline-flex items-center rounded-lg p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === l.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={
          editingId
            ? "Edit Data Cuti"
            : `Tambah Data Cuti Manual — ${employeeName}`
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Jenis Cuti</Label>
            <Select
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
            >
              {Object.entries(LEAVE_TYPE_OPTIONS).map(([v, l]) => (
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
            <Label>Alasan (opsional)</Label>
            <Textarea
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              placeholder="Alasan / keterangan cuti"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
