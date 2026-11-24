type Props = {
  quota: number;
  approved: number;
  pending: number;
  remaining: number;
};

export function LeaveBalanceCard({ quota, approved, pending, remaining }: Props) {
  const safeQuota = Math.max(quota, 1);
  const approvedPct = Math.min(100, (approved / safeQuota) * 100);
  const pendingPct = Math.min(100 - approvedPct, (pending / safeQuota) * 100);

  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Saldo Cuti Tahunan
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-[#1B1F2A]">{remaining}</span>
        <span className="text-sm text-slate-500">dari {quota} hari</span>
      </div>

      {/* Progress bar 3 segmen */}
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="flex h-full">
          {approvedPct > 0 && (
            <div
              className="h-full rounded-l-full bg-[#D6194B] transition-all"
              style={{ width: `${approvedPct}%` }}
            />
          )}
          {pendingPct > 0 && (
            <div
              className="h-full"
              style={{
                width: `${pendingPct}%`,
                backgroundImage:
                  "repeating-linear-gradient(45deg,#f97316 0px,#f97316 3px,#fed7aa 3px,#fed7aa 7px)",
              }}
            />
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#D6194B]" />
          Terpakai: {approved} hari
        </span>
        {pending > 0 && (
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg,#f97316 0px,#f97316 3px,#fed7aa 3px,#fed7aa 7px)",
              }}
            />
            Menunggu: {pending} hari
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          Tersisa: {remaining} hari
        </span>
      </div>
    </div>
  );
}
