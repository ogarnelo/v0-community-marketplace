export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-pulse space-y-4">
          <div className="aspect-square rounded-3xl bg-muted" />
          <div className="h-8 w-3/4 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-36 rounded-3xl bg-muted" />
          <div className="h-28 rounded-3xl bg-muted" />
          <div className="h-28 rounded-3xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
