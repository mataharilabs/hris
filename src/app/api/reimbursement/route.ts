import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, isHr } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";

const schema = z.object({
  category: z.string().min(1),
  title: z.string().min(1),
  amount: z.preprocess((v) => Number(v), z.number().int().positive()),
  spentAt: z.string().min(1),
  description: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const scope = req.nextUrl.searchParams.get("scope") ?? "mine";
    const wantAll = scope === "all" && isHr(user.role);

    const rows = await prisma.reimbursementRequest.findMany({
      where: wantAll
        ? { employee: { companyId: user.companyId } }
        : { employeeId: user.id },
      include: { employee: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok(rows);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const data = schema.parse(await req.json());
    const spentAt = new Date(data.spentAt);
    if (Number.isNaN(spentAt.getTime())) {
      return ok({ error: "Tanggal tidak valid" }, 400);
    }

    const created = await prisma.reimbursementRequest.create({
      data: {
        employeeId: user.id,
        category: data.category,
        title: data.title,
        amount: data.amount,
        spentAt,
        description: data.description || null,
      },
    });
    return ok(created, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
