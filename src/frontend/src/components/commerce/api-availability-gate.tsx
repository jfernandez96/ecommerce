"use client";

import { RotateCw } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

async function checkCatalogApi() {
  const response = await api.get("/products", {
    params: { page: 1, pageSize: 1, sortBy: "newest" },
    timeout: 8000,
  });

  const data = response.data as { items?: unknown } | unknown;
  if (!data || typeof data !== "object" || !("items" in data) || !Array.isArray((data as { items?: unknown[] }).items)) {
    throw new Error("Catalog API response is invalid.");
  }
}

export function FullScreenLoadingOverlay({
  onRetry,
  isRetrying = false,
}: {
  onRetry?: () => void;
  isRetrying?: boolean;
}) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
      </div>

      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="h-9 w-36 animate-pulse rounded-full bg-muted" />
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={isRetrying ? "Reintentando" : "Reintentar"}
        >
          <RotateCw size={16} className={isRetrying ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-border bg-background">
            <div className="h-44 animate-pulse bg-gradient-to-r from-muted/60 via-muted to-muted/60" />
            <div className="space-y-2 p-3">
              <div className="h-2.5 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ApiAvailabilityGate({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const verify = useCallback(async () => {
    try {
      setIsRetrying(true);
      await checkCatalogApi();
      setIsReady(true);
    } catch {
      setIsReady(false);
    } finally {
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    const guardedVerify = async () => {
      try {
        await checkCatalogApi();
        if (alive) setIsReady(true);
      } catch {
        if (alive) setIsReady(false);
      } finally {
        if (alive) setIsRetrying(false);
      }
    };

    void guardedVerify();
    const intervalId = window.setInterval(() => {
      void guardedVerify();
    }, 20000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void guardedVerify();
      }
    };

    window.addEventListener("focus", guardedVerify);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", guardedVerify);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (isReady) return <>{children}</>;

  return <FullScreenLoadingOverlay onRetry={() => { void verify(); }} isRetrying={isRetrying} />;
}
