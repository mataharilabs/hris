import { requireUser, isHr } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { annualLeaveBalance } from "@/lib/leave";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { LeaveForm } from "@/components/ess/LeaveForm";
import { ReviewActions } from "@/components/ess/ReviewActions";
import { DeleteLeaveButton } from "@/components/ess/DeleteLeaveButton";
import { StatusBadge } from "@/components/ess/StatusBadge";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const user = await requireUser();
  const hr = isHr(user.role);
  const isAdmin = user.role === "HR_ADMIN";

  const [mine, balance, pending, approvedAll] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { employeeId: user.id },
      include: { substitute: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.employee
      .findUnique({ where: { id: user.id }, select: { leaveQuota: true } })
      .then((e) => annualLeaveBalance(user.id, e?.leaveQuota ?? 0)),
    hr
      ? prisma.leaveRequest.findMany({
          where: {
            status: "PENDING",
            employee: { companyId: user.companyId },
          },
          include: {
            employee: { select: { name: true } },
            substitute: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    hr
      ? prisma.leaveRequest.findMany({
          where: {
            status: "APPROVED",
            employee: { companyId: user.companyId },
          },
          include: {
            employee: { select: { name: true } },
            substitute: { select: { name: true } },
          },
          orderBy: { startDate: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title="Cuti"
        description="Ajukan cuti dan pantau statusnya."
        action={<LeaveForm />}
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-2xl font-bold text-slate-900">
              {balance.remaining}
            </div>
            <div className="text-sm text-slate-500">Sisa cuti tahunan (hari)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-2xl font-bold text-slate-400">
              {balance.used}
            </div>
            <div className="text-sm text-slate-500">Terpakai</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-2xl font-bold text-slate-400">
              {balance.quota}
            </div>
            <div className="text-sm text-slate-500">Kuota</div>
          </CardContent>
        </Card>
      </div>

      {hr && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Menunggu Persetujuan ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pending.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                Tidak ada pengajuan menunggu.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Hari</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Pengganti</TableHead>
                    <TableHead>Tgl Pengajuan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium text-slate-800">
                        {l.employee.name}
                      </TableCell>
                      <TableCell>{LEAVE_TYPE_LABELS[l.type]}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(l.startDate)} – {formatDate(l.endDate)}
                      </TableCell>
                      <TableCell>{l.days}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm text-slate-500">
                        {l.reason ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {l.substitute?.name ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {formatDate(l.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <ReviewActions endpoint={`/api/leave/${l.id}`} />
                          {isAdmin && <DeleteLeaveButton id={l.id} />}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {hr && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Pengajuan Semua Karyawan ({approvedAll.length})</CardTitle>
            <p className="text-xs text-slate-400">
              Daftar cuti yang sudah disetujui.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {approvedAll.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                Belum ada cuti yang disetujui.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Hari</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Pengganti</TableHead>
                    <TableHead>Tgl Pengajuan</TableHead>
                    {isAdmin && <TableHead className="text-right">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedAll.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium text-slate-800">
                        {l.employee.name}
                      </TableCell>
                      <TableCell>{LEAVE_TYPE_LABELS[l.type]}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(l.startDate)} – {formatDate(l.endDate)}
                      </TableCell>
                      <TableCell>{l.days}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm text-slate-500">
                        {l.reason ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {l.substitute?.name ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {formatDate(l.createdAt)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex justify-end">
                            <DeleteLeaveButton id={l.id} />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pengajuan Saya</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {mine.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              Belum ada pengajuan cuti.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Hari</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Pengganti</TableHead>
                  <TableHead>Tgl Pengajuan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mine.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{LEAVE_TYPE_LABELS[l.type]}</TableCell>
                    <TableCell className="text-sm">
                      {formatDate(l.startDate)} – {formatDate(l.endDate)}
                    </TableCell>
                    <TableCell>{l.days}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-slate-500">
                      {l.reason ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {l.substitute?.name ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatDate(l.createdAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={l.status} />
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {l.reviewNote ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
