import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionVelocityAdminLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <Skeleton className="h-48 rounded-3xl" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
      </div>
    </div>
  );
}
