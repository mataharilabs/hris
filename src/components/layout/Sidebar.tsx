"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users2, ArrowLeft } from "lucide-react";
import { navForRole } from "./nav-config";
import type { NavRole } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Sidebar({ role, ssoUrl }: { role: NavRole; ssoUrl: string }) {
  const pathname = usePathname();
  const groups = navForRole(role);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Users2 className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900">HRIS</div>
          <div className="text-[11px] text-slate-400">AsiaCommerce</div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.title}>
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <a
          href={ssoUrl}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
          Kembali ke SSO
        </a>
      </div>
    </aside>
  );
}
