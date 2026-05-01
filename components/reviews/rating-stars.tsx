export default function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i}>
          {i < rating ? "⭐" : "☆"}
        </span>
      ))}
    </div>
  );
}
