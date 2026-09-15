import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import {
  addPoint,
  getKudosQuota,
  KUDOS_POINTS,
  KUDOS_MSG_MAX,
} from "@/lib/gamification";

// GET: Kudos Wall — kudos terbaru satu company.
export async function GET() {
  try {
    const user = await requireUser();
    const rows = await prisma.kudos.findMany({
      where: { sender: { companyId: user.companyId } },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        sender: { select: { id: true, name: true, photoDataUrl: true, departmentName: true } },
        recipient: {
          select: { id: true, name: true, photoDataUrl: true, departmentName: true },
        },
        likes: { where: { employeeId: user.id }, select: { id: true } },
        _count: { select: { likes: true, comments: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          take: 20,
          include: { employee: { select: { name: true, photoDataUrl: true } } },
        },
      },
    });

    return ok(
      rows.map((k) => ({
        id: k.id,
        message: k.message,
        createdAt: k.createdAt.toISOString(),
        sender: k.sender,
        recipient: k.recipient,
        likeCount: k._count.likes,
        commentCount: k._count.comments,
        likedByMe: k.likes.length > 0,
        comments: k.comments.map((c) => ({
          id: c.id,
          message: c.message,
          createdAt: c.createdAt.toISOString(),
          name: c.employee.name,
          photoDataUrl: c.employee.photoDataUrl,
        })),
      }))
    );
  } catch (e) {
    return handleApiError(e);
  }
}

const sendSchema = z.object({
  recipientId: z.string().min(1),
  message: z.string().trim().min(1, "Tulis pesan apresiasi").max(KUDOS_MSG_MAX),
});

// POST: kirim kudos — kurangi kuota harian; +25 pengirim & +25 penerima.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const data = sendSchema.parse(await req.json());

    if (data.recipientId === user.id) {
      return ok({ error: "Tidak bisa kirim kudos ke diri sendiri" }, 400);
    }
    const recipient = await prisma.employee.findFirst({
      where: { id: data.recipientId, companyId: user.companyId, isActive: true },
      select: { id: true, name: true },
    });
    if (!recipient) return ok({ error: "Karyawan tidak ditemukan" }, 404);

    const quota = await getKudosQuota(user.id);
    if (quota.remaining <= 0) {
      return ok({ error: "Kuota kudos harian kamu sudah habis" }, 400);
    }

    const created = await prisma.$transaction(async (tx) => {
      const k = await tx.kudos.create({
        data: {
          senderId: user.id,
          recipientId: recipient.id,
          message: data.message,
        },
      });
      await addPoint(
        tx,
        user.id,
        "KUDOS_SENT",
        KUDOS_POINTS,
        `Kirim Kudos ke ${recipient.name}`
      );
      await addPoint(
        tx,
        recipient.id,
        "KUDOS_RECEIVED",
        KUDOS_POINTS,
        `Kudos dari ${user.name ?? "rekan"}: "${data.message}"`
      );
      return k;
    });

    return ok(created, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
