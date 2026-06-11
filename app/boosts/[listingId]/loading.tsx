export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-4 w-72 rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="aspect-[4/3] rounded-xl bg-muted" />
              <div className="mt-4 h-4 w-3/4 rounded bg-muted" />
              <div className="mt-2 h-4 w-1/2 rounded bg-muted" />
              <div className="mt-4 h-9 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
