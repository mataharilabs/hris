import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicEmployeeTable } from "@/components/public/PublicEmployeeTable";

export const dynamic = "force-dynamic";

export default async function PublicKaryawanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const company = await prisma.company.findUnique({
    where: { shareToken: token },
    select: { name: true },
  });
  if (!company) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-brand-50/30 to-white">
      <PublicHeader companyName={company.name} token={token} active="karyawan" />
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Data Karyawan</h1>
        <p className="mb-6 text-sm text-slate-500">
          Direktori karyawan {company.name}.
        </p>
        <PublicEmployeeTable token={token} />
      </main>
    </div>
  );
}
