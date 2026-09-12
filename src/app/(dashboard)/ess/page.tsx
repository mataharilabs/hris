import Link from "next/link";
import { CalendarDays, Receipt, ArrowRight, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { annualLeaveBalance } from "@/lib/leave";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ess/StatusBadge";
import {
  EMPLOYMENT_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EssHomePage() {
  const user = await requireUser();

  const emp = await prisma.employee.findUnique({ where: { id: user.id } });
  const balance = await annualLeaveBalance(user.id, emp?.leaveQuota ?? 0);

  const [recentLeave, recentReimb] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { employeeId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.reimbursementRequest.findMany({
      where: { employeeId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title={`Halo, ${user.name ?? "Karyawan"}`}
        description="Layanan mandiri karyawan (ESS)."
        action={
          <Link
            href="/leave?new=1"
            className={buttonVariants({ variant: "default" })}
          >
            <Plus className="h-4 w-4" />
            Ajukan Cuti
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
            <Info label="Jabatan" value={emp?.jobTitle} />
            <Info label="Departemen" value={emp?.departmentName} />
            <Info label="Lokasi" value={emp?.officeName} />
            <Info
              label="Status"
              value={
                emp?.employmentStatus
                  ? EMPLOYMENT_STATUS_LABELS[emp.employmentStatus]
                  : null
              }
            />
            <Info
              label="Tanggal Masuk"
              value={emp?.joinDate ? formatDate(emp.joinDate) : null}
            />
            <Info label="Email" value={emp?.email} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-3xl font-bold text-brand-600">
              {balance.remaining}
            </div>
            <div className="text-sm text-slate-500">
              Sisa cuti tahunan (dari {balance.quota} hari)
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <QuickLink
          href="/leave"
          icon={CalendarDays}
          title="Cuti"
          desc="Ajukan & pantau cuti"
        />
        <QuickLink
          href="/reimbursement"
          icon={Receipt}
          title="Reimbursement"
          desc="Ajukan penggantian biaya"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentCard title="Cuti Terbaru" href="/leave">
          {recentLeave.length === 0 ? (
            <Empty>Belum ada pengajuan cuti.</Empty>
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
        </RecentCard>
        <RecentCard title="Reimbursement Terbaru" href="/reimbursement">
          {recentReimb.length === 0 ? (
            <Empty>Belum ada pengajuan reimbursement.</Empty>
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
        </RecentCard>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm text-slate-800">{value || "-"}</div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: typeof CalendarDays;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-brand-200 hover:bg-brand-50/40">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-slate-800">{title}</div>
            <div className="text-sm text-slate-500">{desc}</div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-300" />
        </CardContent>
      </Card>
    </Link>
  );
}

function RecentCard({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <Link href={href} className="text-xs text-brand-700 hover:underline">
          Lihat semua
        </Link>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </Card>
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
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <div className="text-sm font-medium text-slate-800">{left}</div>
        <div className="text-xs text-slate-400">{mid}</div>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-8 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}
