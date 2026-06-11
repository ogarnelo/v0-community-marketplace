export default function AccountLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl border bg-card" />
        ))}
      </div>
    </div>
  );
}
