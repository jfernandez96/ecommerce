import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 space-y-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-12 w-80 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-xl border border-border bg-background p-5">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <article key={index} className="space-y-3">
              <Skeleton className="aspect-[4/5] w-full rounded-md" />
              <div className="space-y-2 px-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-28" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
