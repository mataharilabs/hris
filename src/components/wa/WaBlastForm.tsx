"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";

const MAX_CHARS = 1000;

function minDatetimeLocal(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function WaBlastForm() {
  const [message, setMessage] = useState("");
  const [scheduled, setScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();

  async function submit() {
    if (!message.trim()) {
      toast("Pesan tidak boleh kosong", "error");
      return;
    }
    if (scheduled) {
      if (!scheduledAt) {
        toast("Pilih tanggal & waktu pengiriman", "error");
        return;
      }
      if (new Date(scheduledAt) <= new Date()) {
        toast("Waktu pengiriman harus di masa depan", "error");
        return;
      }
    }
    setSending(true);
    try {
      const res = await fetch("/api/wa-blast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          // Kirim sebagai ISO UTC agar server interpret dengan benar
          scheduledAt: scheduled ? new Date(scheduledAt).toISOString() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Gagal mengirim");
      toast(
        scheduled ? "Pesan berhasil dijadwalkan" : "Pesan terkirim ke grup WhatsApp",
        "success"
      );
      setMessage("");
      setScheduled(false);
      setScheduledAt("");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kirim ke Grup WhatsApp</CardTitle>
        <p className="text-xs text-slate-400">
          Pesan dikirim ke grup WA yang dikonfigurasi di SSO.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Pesan *</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Ketik pesan yang akan dikirim ke grup WA..."
            rows={6}
          />
          <p
            className={`text-right text-xs ${
              message.length >= MAX_CHARS ? "text-red-500" : "text-slate-400"
            }`}
          >
            {message.length}/{MAX_CHARS}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={scheduled}
              onChange={(e) => {
                setScheduled(e.target.checked);
                if (!e.target.checked) setScheduledAt("");
              }}
            />
            <Calendar className="h-4 w-4 text-slate-400" />
            Jadwalkan untuk nanti
          </label>
        </div>

        {scheduled && (
          <div className="space-y-1.5">
            <Label>Tanggal &amp; Waktu Pengiriman *</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              min={minDatetimeLocal()}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <p className="text-xs text-slate-400">
              Waktu disesuaikan dengan timezone perangkat Anda.
            </p>
          </div>
        )}

        <Button
          onClick={submit}
          disabled={sending || !message.trim()}
          className="w-full"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : scheduled ? (
            <Calendar className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {scheduled ? "Jadwalkan" : "Kirim Sekarang"}
        </Button>
      </CardContent>
    </Card>
  );
}
