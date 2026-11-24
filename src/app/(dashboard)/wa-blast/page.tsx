import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WaBlastForm } from "@/components/wa/WaBlastForm";
import { CancelBlastButton } from "@/components/wa/CancelBlastButton";

export const dynamic = "force-dynamic";

const STATUS_MAP: Record<
  string,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Dijadwalkan",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  SENT: {
    label: "Terkirim",
    className: "bg-green-50 text-green-700 border border-green-200",
  },
  FAILED: {
    label: "Gagal",
    className: "bg-red-50 text-red-700 border border-red-200",
  },
  CANCELLED: {
    label: "Dibatalkan",
    className: "bg-slate-50 text-slate-500 border border-slate-200",
  },
};

function wibDateTime(d: Date | string | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function WaBlastPage() {
  const user = await requireUser();
  if (user.role !== "HR_ADMIN") redirect("/dashboard");

  const blasts = await prisma.waBlast.findMany({
    where: { companyId: user.companyId },
    include: { createdBy: { select: { name: true } } },
    orderBy: { scheduledAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Notifikasi WhatsApp"
        description="Kirim pesan atau jadwalkan broadcast ke grup WhatsApp perusahaan."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <WaBlastForm />
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Pesan</CardTitle>
              <p className="text-xs text-slate-400">
                100 pesan terakhir.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {blasts.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-400">
                  Belum ada pesan yang dikirim.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Pesan</TableHead>
                      <TableHead>Dijadwalkan</TableHead>
                      <TableHead>Terkirim</TableHead>
                      <TableHead>Oleh</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blasts.map((b) => {
                      const st = STATUS_MAP[b.status] ?? STATUS_MAP.FAILED;
                      return (
                        <TableRow key={b.id}>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${st.className}`}
                            >
                              {st.label}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <p className="truncate text-sm text-slate-700">
                              {b.message}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {wibDateTime(b.scheduledAt)}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {wibDateTime(b.sentAt)}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {b.createdBy.name}
                          </TableCell>
                          <TableCell className="text-right">
                            {b.status === "PENDING" && (
                              <CancelBlastButton id={b.id} />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
