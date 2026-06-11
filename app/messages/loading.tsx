export default function MessagesLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <div className="h-[70vh] animate-pulse rounded-2xl border bg-card" />
        <div className="h-[70vh] animate-pulse rounded-2xl border bg-card" />
      </div>
    </div>
  );
}
