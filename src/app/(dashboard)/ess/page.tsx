import Link from "next/link";
import { CalendarDays, Receipt, Plus, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { annualLeaveBalance } from "@/lib/leave";
import { listEmployees } from "@/lib/sso-client";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ess/StatusBadge";
import { EmployeeDetails } from "@/components/employees/EmployeeDetails";
import { OnboardingQuest } from "@/components/gamification/OnboardingQuest";
import { AvatarUpload } from "@/components/gamification/AvatarUpload";
import { SelfProfileEditor } from "@/components/gamification/SelfProfileEditor";
import { ActivityFeed } from "@/components/gamification/ActivityFeed";
import { CheckinHero } from "@/components/gamification/CheckinHero";
import {
  EMPLOYMENT_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  hasCheckedInToday,
  getCheckinStreak,
  getWeekCheckins,
  todayRangeWib,
} from "@/lib/gamification";

export const dynamic = "force-dynamic";

function masaKerja(joinDate: Date | null): string {
  if (!joinDate) return "";
  const now = new Date();
  const diff = now.getTime() - joinDate.getTime();
  const totalMonths = Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0 && months === 0) return "< 1 bulan";
  if (years === 0) return `${months} bulan`;
  if (months === 0) return `${years} tahun`;
  return `${years} tahun ${months} bulan`;
}

export default async function EssHomePage() {
  const user = await requireUser();

  const emp = await prisma.employee.findUnique({ where: { id: user.id } });
  const balance = await annualLeaveBalance(
    user.id,
    emp?.leaveQuota ?? 0,
    emp?.leaveAdjustment ?? 0
  );

  const ssoList = emp?.ssoUserId
    ? await listEmployees({ companyId: user.ssoCompanyId })
    : [];
  const ssoFull = ssoList.find((x) => x.id === emp?.ssoUserId) ?? null;
  const full =
    ssoFull && emp
      ? {
          ...ssoFull,
          birthDate: emp.birthDate ? emp.birthDate.toISOString() : null,
          emergencyName: emp.emergencyName,
          emergencyRelation: emp.emergencyRelation,
          emergencyPhone: emp.emergencyPhone,
        }
      : ssoFull;

  const [recentLeave, recentReimb] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { employeeId: user.id },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.reimbursementRequest.findMany({
      where: { employeeId: user.id },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  // Checkin data for hero
  const { start: todayStart, end: todayEnd } = todayRangeWib();
  const [checkedInToday, streak, weekCheckins, coworkersCheckedIn, totalCoworkers] =
    await Promise.all([
      hasCheckedInToday(user.id),
      getCheckinStreak(user.id),
      getWeekCheckins(user.id),
      prisma.pointEntry.findMany({
        where: {
          type: "DAILY_CHECKIN",
          createdAt: { gte: todayStart, lt: todayEnd },
          employee: { companyId: user.companyId },
        },
        select: { employeeId: true },
        distinct: ["employeeId"],
      }).then((r) => r.length),
      prisma.employee.count({ where: { companyId: user.companyId } }),
    ]);

  const firstName = (user.name ?? "Karyawan").split(" ")[0];
  const todayId = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  return (
    <div className="pb-10">
      {/* Top bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {todayId}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Halo, {firstName} 👋
          </h1>
        </div>
        <Link
          href="/leave?new=1"
          className={buttonVariants({ variant: "default" })}
        >
          <Plus className="h-4 w-4" />
          Ajukan Cuti
        </Link>
      </div>

      {/* Hero check-in */}
      <CheckinHero
        name={user.name ?? "Karyawan"}
        initialCheckedIn={checkedInToday}
        initialStreak={streak}
        initialWeek={weekCheckins}
        coworkersCheckedIn={coworkersCheckedIn}
        totalCoworkers={totalCoworkers}
      />

      {/* 2-column grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        {/* Left — quest + feed */}
        <div className="flex flex-col gap-5">
          <OnboardingQuest />
          <ActivityFeed />
        </div>

        {/* Right — profile + leave + reimbursement */}
        <div className="flex flex-col gap-5">
          {/* Profile card */}
          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex items-start gap-4">
                <AvatarUpload
                  name={user.name ?? "Karyawan"}
                  initialPhoto={emp?.photoDataUrl ?? null}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-slate-900">
                    {user.name ?? "Karyawan"}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-slate-500">
                    {emp?.jobTitle ?? emp?.departmentName ?? "—"}
                  </div>
                  {emp?.joinDate && (
                    <div className="mt-1 text-xs text-slate-400">
                      {masaKerja(emp.joinDate)} masa kerja
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
                <KV label="Departemen" value={emp?.departmentName} />
                <KV label="Lokasi" value={emp?.officeName} />
                <KV
                  label="Status"
                  value={
                    emp?.employmentStatus
                      ? EMPLOYMENT_STATUS_LABELS[emp.employmentStatus]
                      : null
                  }
                />
                <KV label="Email" value={emp?.email} />
              </div>

              <SelfProfileEditor
                birthDate={emp?.birthDate ? emp.birthDate.toISOString() : null}
                emergencyName={emp?.emergencyName ?? null}
                emergencyRelation={emp?.emergencyRelation ?? null}
                emergencyPhone={emp?.emergencyPhone ?? null}
              />
            </CardContent>
          </Card>

          {/* Leave card */}
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand-600" />
                <span className="text-sm font-semibold text-slate-800">Cuti</span>
              </div>
              <Link
                href="/leave"
                className="flex items-center gap-0.5 text-xs text-brand-700 hover:underline"
              >
                Lihat semua <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="flex items-baseline gap-2 px-4 pb-2 pt-3">
              <span className="text-3xl font-extrabold text-brand-600">
                {balance.remaining}
              </span>
              <span className="text-sm text-slate-400">
                dari {balance.quota} hari tersisa
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {recentLeave.length === 0 ? (
                <EmptyRow>Belum ada pengajuan.</EmptyRow>
              ) : (
                recentLeave.map((l) => (
                  <Row
                    key={l.id}
                    left={LEAVE_TYPE_LABELS[l.type]}
                    mid={`${formatDate(l.startDate)} · ${l.days} hari`}
                    status={l.status}
                  />
                ))
              )}
            </div>
          </Card>

          {/* Reimbursement card */}
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-brand-600" />
                <span className="text-sm font-semibold text-slate-800">
                  Reimbursement
                </span>
              </div>
              <Link
                href="/reimbursement"
                className="flex items-center gap-0.5 text-xs text-brand-700 hover:underline"
              >
                Lihat semua <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recentReimb.length === 0 ? (
                <EmptyRow>Belum ada pengajuan.</EmptyRow>
              ) : (
                recentReimb.map((r) => (
                  <Row
                    key={r.id}
                    left={r.title}
                    mid={formatCurrency(r.amount)}
                    status={r.status}
                  />
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Employee details (collapsible) */}
      <div className="mt-5">
        <EmployeeDetails full={full} />
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="truncate text-sm text-slate-700">{value || "—"}</div>
    </div>
  );
}

function Row({
  left,
  mid,
  status,
}: {
  left: string;
  mid: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-800">{left}</div>
        <div className="text-xs text-slate-400">{mid}</div>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-6 text-center text-sm text-slate-400">{children}</div>
  );
}
