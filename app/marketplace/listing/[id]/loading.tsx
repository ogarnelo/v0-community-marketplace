import { Skeleton } from "@/components/ui/skeleton";

export default function ListingDetailLoading() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 pb-28 md:pb-8">
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-48" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
            <Skeleton className="h-9 w-3/4" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-9 w-36" />
            <Skeleton className="mt-5 h-20 w-full rounded-2xl" />
            <Skeleton className="mt-6 h-11 w-full" />
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="mt-3 h-4 w-40" />
            <Skeleton className="mt-2 h-4 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
