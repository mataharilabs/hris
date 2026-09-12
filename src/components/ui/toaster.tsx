"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";
type ToastItem = { id: number; message: string; variant: ToastVariant };

const EVENT = "app:toast";

export function toast(message: string, variant: ToastVariant = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, variant } }));
}

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const styles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-slate-200 bg-white text-slate-800",
};

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    let counter = 0;
    function onToast(e: Event) {
      const detail = (e as CustomEvent).detail as {
        message: string;
        variant: ToastVariant;
      };
      const id = ++counter;
      setToasts((prev) => [...prev, { id, ...detail }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    }
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 no-print">
      {toasts.map((t) => {
        const Icon = icons[t.variant];
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg min-w-[280px] max-w-md",
              styles[t.variant]
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
              className="text-current/60 hover:text-current cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
