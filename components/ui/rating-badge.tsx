
"use client";

export default function RatingBadge({ rating, count }: { rating: number | null, count: number }) {
  if (!rating || count === 0) return null;

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700">
      ⭐ {rating.toFixed(1)} ({count})
    </div>
  );
}
