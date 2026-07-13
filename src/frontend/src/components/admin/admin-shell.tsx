"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AdminShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/admin");
  };

  return (
    <main className="mx-auto w-full max-w-[1680px] px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
      <section className="admin-surface overflow-hidden">
        <div className="border-b border-border/80 bg-gradient-to-r from-primary/12 via-white to-accent/10 px-4 py-4 dark:via-slate-900 sm:px-6 lg:px-7 lg:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="admin-section-title">Workspace</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-[2rem]">{title}</h1>
              <p className="mt-1 text-sm text-foreground/65">{description}</p>
            </div>
            <Button variant="secondary" type="button" onClick={handleBack} className="h-10 rounded-xl border-white/70 bg-white/85 px-4 text-foreground shadow-sm hover:bg-white dark:border-border dark:bg-muted/70">
              <ArrowLeft size={17} /> Regresar
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-7">
          {children}
        </div>
      </section>
    </main>
  );
}
