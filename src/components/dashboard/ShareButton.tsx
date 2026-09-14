"use client";

import { useState } from "react";
import { Share2, Copy, Check, Loader2, BarChart3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";

function LinkRow({
  icon: Icon,
  title,
  desc,
  url,
}: {
  icon: typeof BarChart3;
  title: string;
  desc: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link disalin", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-medium text-slate-800">{title}</div>
          <div className="text-xs text-slate-400">{desc}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600"
        />
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          Buka
        </a>
      </div>
    </div>
  );
}

export function ShareButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  async function openModal() {
    setOpen(true);
    if (token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/share");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data.error ?? "Gagal");
      setToken(data.token);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const demografiUrl = token ? `${origin}/public/hr/${token}` : "";
  const dataUrl = token ? `${origin}/public/hr/${token}/karyawan` : "";

  return (
    <>
      <Button variant="outline" onClick={openModal}>
        <Share2 className="h-4 w-4" />
        Share
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Bagikan Link Publik"
        description="Tautan berikut dapat diakses umum tanpa login."
      >
        {loading || !token ? (
          <div className="flex justify-center py-10 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            <LinkRow
              icon={BarChart3}
              title="Link Demografi"
              desc="Dashboard demografi karyawan (grafik & jumlah)."
              url={demografiUrl}
            />
            <LinkRow
              icon={Users}
              title="Link Data Karyawan"
              desc="Tabel database karyawan dengan filter."
              url={dataUrl}
            />
            <p className="text-xs text-slate-400">
              Siapa pun dengan link ini bisa melihat data. Data sensitif (NIK,
              NPWP, gaji) tidak ditampilkan di halaman publik.
            </p>
          </div>
        )}
      </Dialog>
    </>
  );
}
