"use client";

import { useState } from "react";
import { LogOut, ChevronDown } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { initials } from "@/lib/utils";
import { ROLE_LABELS, type NavRole } from "@/lib/constants";
import { MobileNav } from "./MobileNav";
import { GamificationBar } from "@/components/gamification/GamificationBar";

type HeaderProps = {
  name: string;
  email: string;
  role: string;
  companyName: string;
  ssoUrl: string;
};

export function Header({ name, email, role, companyName, ssoUrl }: HeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <MobileNav role={role as NavRole} ssoUrl={ssoUrl} />
        <div>
          <div className="text-sm font-semibold text-slate-800">
            {companyName}
          </div>
          <div className="text-xs text-slate-400">HRIS</div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <GamificationBar />
        <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 cursor-pointer"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {initials(name)}
          </div>
          <div className="hidden text-left sm:block">
            <div className="text-sm font-medium text-slate-800">{name}</div>
            <div className="text-xs text-slate-400">
              {ROLE_LABELS[role] ?? role}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="text-sm font-medium text-slate-800">{name}</div>
                <div className="truncate text-xs text-slate-400">{email}</div>
              </div>
              <form action={logout}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar
                </button>
              </form>
            </div>
          </>
        )}
        </div>
      </div>
    </header>
  );
}
