export default function SkeletonCard() {
  return (
    <div className="animate-pulse border rounded-xl p-4 space-y-2">
      <div className="bg-muted h-40 rounded-md" />
      <div className="bg-muted h-4 w-3/4 rounded" />
      <div className="bg-muted h-4 w-1/2 rounded" />
    </div>
  );
}
