"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { initials } from "@/lib/utils";
import { refreshGami } from "./GamificationBar";

// Perkecil gambar ke maks 256px lalu jadikan data URL JPEG.
function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas gagal"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AvatarUpload({
  name,
  initialPhoto,
}: {
  name: string;
  initialPhoto: string | null;
}) {
  const [photo, setPhoto] = useState<string | null>(initialPhoto);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("File harus gambar", "error");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await resizeToDataUrl(file);
      const res = await fetch("/api/profile/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) throw new Error(d.error ?? "Gagal unggah");
      setPhoto(dataUrl);
      toast("Foto profil diperbarui", "success");
      refreshGami();
      router.refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt="Foto profil"
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
            {initials(name)}
          </div>
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {photo ? "Ubah Foto" : "Setup Foto Profil"}
        </button>
      </div>
    </div>
  );
}
