import RatingStars from "@/components/reviews/rating-stars";

export default function ProfileRating({ reviews }: any) {
  const avg = reviews?.length
    ? reviews.reduce((a:any,b:any)=>a+b.rating,0)/reviews.length
    : 0;

  return (
    <div>
      <RatingStars rating={Math.round(avg)} />
      <p>{avg.toFixed(1)} ({reviews.length} valoraciones)</p>
    </div>
  );
}
