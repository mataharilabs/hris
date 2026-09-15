import { prisma } from "@/lib/prisma";
import type { PrismaClient, Prisma, PointType } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const DAILY_KUDOS_QUOTA = 5;
export const KUDOS_POINTS = 25;
export const CHECKIN_POINTS = 5;
export const ONBOARDING_POINTS = 25;
export const KUDOS_MSG_MAX = 50;

function wibYear(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
    }).format(now)
  );
}
function yearRange(now = new Date()) {
  const y = wibYear(now);
  return {
    start: new Date(`${y}-01-01T00:00:00+07:00`),
    end: new Date(`${y + 1}-01-01T00:00:00+07:00`),
  };
}
function todayRange(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(now);
  const start = new Date(`${today}T00:00:00+07:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** Total poin tahun berjalan (reset otomatis tiap tahun). */
export async function getPointsThisYear(employeeId: string): Promise<number> {
  const { start, end } = yearRange();
  const agg = await prisma.pointEntry.aggregate({
    where: { employeeId, createdAt: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

export async function getKudosQuota(employeeId: string) {
  const { start, end } = todayRange();
  const used = await prisma.kudos.count({
    where: { senderId: employeeId, createdAt: { gte: start, lt: end } },
  });
  return {
    quota: DAILY_KUDOS_QUOTA,
    used,
    remaining: Math.max(0, DAILY_KUDOS_QUOTA - used),
  };
}

export async function getSummary(employeeId: string) {
  const [points, quota] = await Promise.all([
    getPointsThisYear(employeeId),
    getKudosQuota(employeeId),
  ]);
  return { points, quota };
}

export async function addPoint(
  db: Db,
  employeeId: string,
  type: PointType,
  amount: number,
  note?: string
) {
  await db.pointEntry.create({ data: { employeeId, type, amount, note: note ?? null } });
}

export type ActivityItem = {
  id: string;
  type: PointType;
  note: string | null;
  amount: number;
  createdAt: string;
};

export async function getActivity(
  employeeId: string,
  take = 20
): Promise<ActivityItem[]> {
  const rows = await prisma.pointEntry.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    note: r.note,
    amount: r.amount,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function hasCheckedInToday(employeeId: string): Promise<boolean> {
  const { start, end } = todayRange();
  const c = await prisma.pointEntry.count({
    where: {
      employeeId,
      type: "DAILY_CHECKIN",
      createdAt: { gte: start, lt: end },
    },
  });
  return c > 0;
}

type OnboardingEmp = {
  id: string;
  birthDate: Date | null;
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
  photoDataUrl: string | null;
  onboardingClaimedAt: Date | null;
};

export async function getOnboarding(emp: OnboardingEmp) {
  const kudosCount = await prisma.kudos.count({ where: { senderId: emp.id } });
  const steps = [
    { key: "birthDate", label: "Lengkapi Tanggal Lahir", done: !!emp.birthDate },
    {
      key: "emergency",
      label: "Data Kontak Darurat",
      done: !!(emp.emergencyName && emp.emergencyRelation && emp.emergencyPhone),
    },
    { key: "photo", label: "Setup Foto Profil", done: !!emp.photoDataUrl },
    { key: "kudos", label: "Kirim Kudos Pertama", done: kudosCount > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const percent = doneCount * 25;
  return {
    steps,
    percent,
    claimed: !!emp.onboardingClaimedAt,
    claimable: percent === 100 && !emp.onboardingClaimedAt,
  };
}
