"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users2,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { navForRole } from "./nav-config";
import type { NavRole } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "hris-sidebar-collapsed";

export function Sidebar({ role, ssoUrl }: { role: NavRole; ssoUrl: string }) {
  const pathname = usePathname();
  const groups = navForRole(role);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-slate-100",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Users2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">HRIS</div>
              <div className="text-[11px] text-slate-400">AsiaCommerce</div>
            </div>
          </div>
        )}
        <button
          onClick={toggle}
          title={collapsed ? "Perluas sidebar" : "Sembunyikan sidebar"}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
            )}
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
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors",
                      collapsed ? "justify-center px-2" : "px-3",
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && item.label}
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
          title={collapsed ? "Kembali ke SSO" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            collapsed ? "justify-center px-2" : "px-3"
          )}
        >
          <ArrowLeft className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && "Kembali ke SSO"}
        </a>
      </div>
    </aside>
  );
}
