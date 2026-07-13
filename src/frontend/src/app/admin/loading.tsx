import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[250px_1fr]">
      <aside className="h-fit rounded-md border border-border p-3 lg:sticky lg:top-24">
        <Skeleton className="mb-4 h-6 w-20" />
        <div className="grid gap-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </aside>

      <section>
        <div className="mb-4 overflow-hidden rounded-full bg-border/70">
          <div className="h-1 w-full animate-[pulse_1.15s_ease-in-out_infinite] rounded-full bg-foreground/75" />
        </div>
        <div className="mb-6 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-72 max-w-full" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-md border border-border p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-4 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-4/5" />
              <Skeleton className="mt-6 h-28 w-full rounded-md" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
