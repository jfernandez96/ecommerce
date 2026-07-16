"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";

type MobileFilterDrawerProps = {
  title?: string;
  buttonLabel?: string;
  activeCount?: number;
  children: ReactNode;
};

export function MobileFilterDrawer({ title = "Filtros", buttonLabel = "Filtros", activeCount = 0, children }: MobileFilterDrawerProps) {
  const [open, setOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setOpen(false);
    }
  }, [pathname, searchParamsKey]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
      >
        <SlidersHorizontal size={14} /> {buttonLabel}
        {activeCount > 0 && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {isMounted && open && createPortal(
        <div className="fixed inset-0 z-[9999] lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
          <button type="button" aria-label="Cerrar filtros" className="absolute inset-0 z-[10000] bg-black/45" onClick={() => setOpen(false)} />

          <div className="absolute inset-x-0 bottom-0 z-[10001] max-h-[85vh] overflow-y-auto rounded-t-3xl border border-border bg-background p-4 shadow-2xl">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between border-b border-border bg-background px-4 py-3">
              <h2 className="text-lg font-black">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-muted"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 pb-20">{children}</div>

            <div className="pointer-events-none sticky bottom-0 -mx-4 mt-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="pointer-events-auto w-full rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                Cerrar filtros
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
