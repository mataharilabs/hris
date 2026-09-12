// Kirim notifikasi terpusat lewat SSO (hub WhatsApp + Email).
// Best-effort: kegagalan hanya di-log, tidak melempar error.

const SSO_URL = process.env.SSO_URL ?? "";
const KEY = process.env.SERVICE_API_KEY ?? "";

export type NotifyChannel = "email" | "whatsapp";

export async function notify(input: {
  to: { email?: string | null; phone?: string | null };
  subject?: string;
  message: string;
  channels?: NotifyChannel[];
}): Promise<void> {
  if (!SSO_URL || !KEY) return;
  if (!input.to.email && !input.to.phone) return;
  try {
    await fetch(`${SSO_URL}/api/service/notify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[NOTIFY]", (e as Error).message);
  }
}
