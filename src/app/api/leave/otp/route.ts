import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { notifyResult } from "@/lib/notify-client";
import { dayCount } from "@/lib/leave";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

const schema = z.object({
  recipientId: z.string().min(1),
  role: z.enum(["substitute", "manager"]).default("substitute"),
  type: z.enum(["ANNUAL", "SICK", "SICK_CERTIFIED", "UNPAID", "OTHER"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().min(1),
  task: z.string().optional(),
});

const RESEND_COOLDOWN_MS = 60 * 1000; // 1 menit
const TTL_MS = 5 * 60 * 1000; // berlaku 5 menit

const ROLE_LABEL = {
  substitute: "karyawan pengganti",
  manager: "Manager/Lead penyetuju",
} as const;

function maskEmail(e?: string | null): string | null {
  if (!e) return null;
  const [u, d] = e.split("@");
  if (!d) return e;
  return `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
}
function maskPhone(p?: string | null): string | null {
  if (!p) return null;
  const d = p.replace(/\D/g, "");
  return d.length <= 4 ? d : `${"*".repeat(d.length - 4)}${d.slice(-4)}`;
}

// Kirim kode konfirmasi ke penerima (karyawan pengganti / Manager-Lead).
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    const { recipientId, role } = body;
    const roleLabel = ROLE_LABEL[role];

    if (recipientId === user.id) {
      return ok({ error: `${roleLabel} tidak boleh diri sendiri` }, 400);
    }

    const rcpt = await prisma.employee.findFirst({
      where: { id: recipientId, companyId: user.companyId, isActive: true },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (!rcpt) return ok({ error: `${roleLabel} tidak ditemukan` }, 404);
    if (!rcpt.email && !rcpt.phone) {
      return ok({ error: `${roleLabel} tidak punya email/WhatsApp` }, 400);
    }

    // Rate limit resend (1 menit sejak kode terakhir untuk penerima ini).
    const last = await prisma.substituteOtp.findFirst({
      where: { requesterId: user.id, substituteId: recipientId, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) / 1000
      );
      return ok({ error: `Tunggu ${wait} detik untuk mengirim ulang kode` }, 429);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + TTL_MS);
    await prisma.substituteOtp.create({
      data: { requesterId: user.id, substituteId: recipientId, code, expiresAt },
    });

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    const validDates = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime());
    const days = validDates ? dayCount(start, end) : 0;
    const detail =
      `Detail cuti ${user.name ?? "rekan"}:\n` +
      `• Jenis: ${LEAVE_TYPE_LABELS[body.type]}\n` +
      (validDates
        ? `• Tanggal: ${formatDate(start)} – ${formatDate(end)} (${days} hari)\n`
        : "") +
      `• Alasan: ${body.reason}\n` +
      (body.task ? `• Tugas/hand-over: ${body.task}\n` : "");

    const result = await notifyResult({
      to: { email: rcpt.email, phone: rcpt.phone },
      subject: `Kode Konfirmasi Cuti (${role === "manager" ? "Manager/Lead" : "Pengganti"})`,
      message:
        `Halo ${rcpt.name},\n\n` +
        `${user.name ?? "Seorang rekan"} mengajukan cuti dan menjadikan Anda ${roleLabel}.\n\n` +
        detail +
        `\nKode konfirmasi: *${code}* (berlaku 5 menit).\n` +
        `Bagikan kode ini ke pemohon bila Anda menyetujui.\n\n— HRIS AsiaCommerce`,
    });

    const sentEmail = Boolean(result?.email?.sent);
    const sentWhatsapp = Boolean(result?.whatsapp?.sent);
    if (!sentEmail && !sentWhatsapp) {
      return ok(
        {
          error:
            "Kode gagal dikirim. Pastikan notifikasi Email/WhatsApp aktif di SSO.",
        },
        502
      );
    }

    return ok({
      ok: true,
      sentEmail,
      sentWhatsapp,
      recipient: {
        name: rcpt.name,
        email: maskEmail(rcpt.email),
        phone: maskPhone(rcpt.phone),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
