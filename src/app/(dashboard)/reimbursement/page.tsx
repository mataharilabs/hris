import { requireUser, isHr } from "@/lib/session";
import { prisma } from "@/lib/prisma";
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
import { ReimbursementForm } from "@/components/ess/ReimbursementForm";
import { ReviewActions } from "@/components/ess/ReviewActions";
import { StatusBadge } from "@/components/ess/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReimbursementPage() {
  const user = await requireUser();
  const hr = isHr(user.role);

  const [mine, pending] = await Promise.all([
    prisma.reimbursementRequest.findMany({
      where: { employeeId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    hr
      ? prisma.reimbursementRequest.findMany({
          where: {
            status: "PENDING",
            employee: { companyId: user.companyId },
          },
          include: { employee: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title="Reimbursement"
        description="Ajukan penggantian biaya dan pantau statusnya."
        action={<ReimbursementForm />}
      />

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
                    <TableHead>Kategori</TableHead>
                    <TableHead>Judul</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-slate-800">
                        {r.employee.name}
                      </TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell className="text-sm">{r.title}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(r.spentAt)}
                      </TableCell>
                      <TableCell>{formatCurrency(r.amount)}</TableCell>
                      <TableCell>
                        <ReviewActions
                          endpoint={`/api/reimbursement/${r.id}`}
                        />
                      </TableCell>
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
              Belum ada pengajuan reimbursement.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Judul</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mine.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.category}</TableCell>
                    <TableCell className="text-sm">{r.title}</TableCell>
                    <TableCell className="text-sm">
                      {formatDate(r.spentAt)}
                    </TableCell>
                    <TableCell>{formatCurrency(r.amount)}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
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
