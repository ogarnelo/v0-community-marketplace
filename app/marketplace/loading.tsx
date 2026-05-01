export default function MarketplaceLoading() {
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-6 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="animate-pulse overflow-hidden rounded-2xl border bg-card">
          <div className="aspect-[4/3] bg-muted" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-2/3 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
