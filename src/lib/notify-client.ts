// Kirim notifikasi terpusat lewat SSO (hub WhatsApp + Email).
// Best-effort: kegagalan hanya di-log, tidak melempar error.

const SSO_URL = process.env.SSO_URL ?? "";
const KEY = process.env.SERVICE_API_KEY ?? "";

export type NotifyChannel = "email" | "whatsapp";

export type NotifyResult = {
  email?: { sent: boolean; error?: string };
  whatsapp?: { sent: boolean; error?: string };
};

export type NotifyInput = {
  to: { email?: string | null; phone?: string | null };
  subject?: string;
  message: string;
  channels?: NotifyChannel[];
};

/** Kirim notifikasi & kembalikan hasil per-channel (null bila tak terkonfigurasi/gagal koneksi). */
export async function notifyResult(input: NotifyInput): Promise<NotifyResult | null> {
  if (!SSO_URL || !KEY) return null;
  if (!input.to.email && !input.to.phone) return null;
  try {
    const res = await fetch(`${SSO_URL}/api/service/notify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return (data.result as NotifyResult) ?? null;
  } catch (e) {
    console.error("[NOTIFY]", (e as Error).message);
    return null;
  }
}

/** Kirim notifikasi best-effort (tanpa peduli hasil). */
export async function notify(input: NotifyInput): Promise<void> {
  await notifyResult(input);
}
