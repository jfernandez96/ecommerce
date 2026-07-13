"use client";

import { AlertTriangle, CheckCircle2, ShieldAlert, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogTone = "success" | "warning" | "danger";

const toneStyles: Record<ConfirmDialogTone, { icon: typeof CheckCircle2; badge: string; panel: string; glow: string; action: string; }> = {
  success: {
    icon: CheckCircle2,
    badge: "bg-emerald-500/12 text-emerald-700",
    panel: "border-emerald-200/70",
    glow: "from-emerald-500/12 via-transparent to-transparent",
    action: "border-emerald-300/55 bg-emerald-50 text-emerald-900",
  },
  warning: {
    icon: AlertTriangle,
    badge: "bg-amber-500/14 text-amber-700",
    panel: "border-amber-200/80",
    glow: "from-amber-500/12 via-transparent to-transparent",
    action: "border-amber-300/55 bg-amber-50 text-amber-900",
  },
  danger: {
    icon: ShieldAlert,
    badge: "bg-rose-500/12 text-rose-700",
    panel: "border-rose-200/80",
    glow: "from-rose-500/12 via-transparent to-transparent",
    action: "border-rose-300/55 bg-rose-50 text-rose-900",
  },
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Seguir revisando",
  tone = "warning",
  isLoading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const styles = toneStyles[tone];
  const Icon = styles.icon;

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/38 px-4 py-6 backdrop-blur-sm sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Cerrar confirmacion"
      />
      <div
        className={cn(
          "relative w-full max-w-lg overflow-hidden rounded-[28px] border bg-background shadow-[0_24px_80px_rgba(15,23,42,0.22)]",
          styles.panel
        )}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <div className={cn("absolute inset-x-0 top-0 h-24 bg-gradient-to-b", styles.glow)} />

        <div className="relative p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className={cn("inline-flex h-14 w-14 items-center justify-center rounded-2xl border", styles.badge, styles.action)}>
              <Icon size={24} />
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground/55 transition hover:bg-muted hover:text-foreground"
              onClick={onClose}
              aria-label="Cerrar dialogo"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/45">Confirmacion de accion</p>
            <h3 id="confirm-dialog-title" className="text-2xl font-black tracking-tight text-foreground">
              {title}
            </h3>
            <p id="confirm-dialog-description" className="max-w-md text-sm leading-6 text-foreground/68">
              {description}
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Button type="button" variant="ghost" className="h-12 rounded-2xl border border-border/80" onClick={onClose} disabled={isLoading}>
              {cancelLabel}
            </Button>
            <Button type="button" className="h-12 rounded-2xl px-6" onClick={onConfirm} disabled={isLoading}>
              {isLoading ? "Procesando..." : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
