import Link from "next/link";
import { Users2, BarChart3, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function PublicHeader({
  companyName,
  token,
  active,
}: {
  companyName: string;
  token: string;
  active: "demografi" | "karyawan";
}) {
  const tab = (
    href: string,
    key: "demografi" | "karyawan",
    icon: typeof BarChart3,
    label: string
  ) => {
    const Icon = icon;
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
          active === key
            ? "bg-brand-50 text-brand-700"
            : "text-slate-600 hover:bg-slate-50"
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Users2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{companyName}</div>
            <div className="text-[11px] text-slate-400">HRIS · Halaman Publik</div>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {tab(`/public/hr/${token}`, "demografi", BarChart3, "Demografi")}
          {tab(`/public/hr/${token}/karyawan`, "karyawan", Users, "Data Karyawan")}
        </nav>
      </div>
    </header>
  );
}
