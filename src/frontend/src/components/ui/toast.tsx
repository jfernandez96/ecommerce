"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useAppToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useAppToast debe usarse dentro de ToastProvider");
  }

  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timeoutRef = useRef<Record<string, number>>({});

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    if (timeoutRef.current[id]) {
      window.clearTimeout(timeoutRef.current[id]);
      delete timeoutRef.current[id];
    }
  }, []);

  const push = useCallback((message: string, variant: ToastVariant) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((current) => [
      { id, message, variant },
      ...current,
    ].slice(0, 5));

    timeoutRef.current[id] = window.setTimeout(() => {
      remove(id);
    }, 3600);
  }, [remove]);

  const value = useMemo<ToastContextValue>(() => ({
    success: (message) => push(message, "success"),
    error: (message) => push(message, "error"),
    info: (message) => push(message, "info"),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(92vw,380px)] flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur",
              item.variant === "success" && "border-emerald-300/50 bg-emerald-50/95 text-emerald-900",
              item.variant === "error" && "border-red-300/55 bg-red-50/95 text-red-900",
              item.variant === "info" && "border-slate-300/60 bg-white/96 text-slate-900 dark:border-slate-700 dark:bg-slate-900/96 dark:text-slate-100"
            )}
            role="status"
            aria-live="polite"
          >
            {item.variant === "success" && <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
            {item.variant === "error" && <XCircle size={18} className="mt-0.5 shrink-0" />}
            {item.variant === "info" && <Info size={18} className="mt-0.5 shrink-0" />}
            <p className="text-sm leading-snug">{item.message}</p>
            <button
              type="button"
              className="ml-auto shrink-0 rounded p-0.5 text-current/70 hover:bg-black/5 hover:text-current"
              onClick={() => remove(item.id)}
              aria-label="Cerrar notificacion"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
