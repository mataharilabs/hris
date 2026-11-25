import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

// GET: ringkasan sidebar kudos — diterima, dikirim, top penerima bulan ini.
export async function GET() {
  try {
    const user = await requireUser();

    const TZ_OFFSET = "+07:00";
    const now = new Date();
    const monthStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(now);
    const [year, month] = monthStr.split("-");
    const monthStart = new Date(`${year}-${month}-01T00:00:00${TZ_OFFSET}`);
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const [receivedCount, sentCount, monthKudos] = await Promise.all([
      prisma.kudos.count({ where: { recipientId: user.id } }),
      prisma.kudos.count({ where: { senderId: user.id } }),
      prisma.kudos.findMany({
        where: {
          sender: { companyId: user.companyId },
          createdAt: { gte: monthStart, lt: nextMonth },
        },
        select: { recipientId: true, recipient: { select: { id: true, name: true, photoDataUrl: true } } },
      }),
    ]);

    // Count per recipient this month
    const countMap: Record<string, { id: string; name: string; photoDataUrl: string | null; count: number }> = {};
    for (const k of monthKudos) {
      const r = k.recipient;
      if (!countMap[r.id]) countMap[r.id] = { id: r.id, name: r.name, photoDataUrl: r.photoDataUrl, count: 0 };
      countMap[r.id].count++;
    }
    const topRecipients = Object.values(countMap)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 3);

    return ok({ receivedCount, sentCount, topRecipients });
  } catch (e) {
    return handleApiError(e);
  }
}
