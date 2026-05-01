import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/marketplace/formatters";
import type { ListingRow, ProfileRow, ReviewRow } from "@/lib/types/marketplace";

export const dynamic = "force-dynamic";

async function loadReviews(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from("transaction_reviews")
      .select("rating, comment, created_at, reviewer_id, reviewed_user_id, payment_intent_id")
      .eq("reviewed_user_id", userId)
      .order("created_at", { ascending: false });

    if (!error) return (data || []) as ReviewRow[];
  } catch {}

  try {
    const { data } = await supabase
      .from("reviews")
      .select("rating, comment, created_at, reviewer_id, reviewed_user_id, listing_id")
      .eq("reviewed_user_id", userId)
      .order("created_at", { ascending: false });

    return (data || []) as ReviewRow[];
  } catch {
    return [] as ReviewRow[];
  }
}

export default async function ReviewsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/account/reviews");

  const reviews = await loadReviews(supabase, user.id);
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1)
      : "0";

  const reviewerIds = Array.from(new Set(reviews.map((review) => review.reviewer_id).filter(Boolean))) as string[];
  const listingIds = Array.from(new Set(reviews.map((review) => review.listing_id).filter(Boolean))) as string[];

  const [{ data: reviewersData }, { data: listingsData }] = await Promise.all([
    reviewerIds.length > 0 ? supabase.from("profiles").select("id, full_name").in("id", reviewerIds) : Promise.resolve({ data: [] as ProfileRow[] }),
    listingIds.length > 0 ? supabase.from("listings").select("id, title").in("id", listingIds) : Promise.resolve({ data: [] as ListingRow[] }),
  ]);

  const reviewerMap = new Map(((reviewersData || []) as Pick<ProfileRow, "id" | "full_name">[]).map((profile) => [profile.id, profile]));
  const listingMap = new Map(((listingsData || []) as Pick<ListingRow, "id" | "title">[]).map((listing) => [listing.id, listing]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
      <Link href="/account">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Volver a mi cuenta
        </Button>
      </Link>

      <h1 className="text-2xl font-bold text-foreground">Mis opiniones</h1>
      <p className="text-sm text-muted-foreground">Lo que otros usuarios dicen de ti</p>

      <Card className="mt-6 border-border">
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <div className="text-center">
            <p className="text-4xl font-bold text-foreground">{avgRating}</p>
            <div className="mt-1 flex items-center justify-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < Math.round(Number(avgRating)) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{reviews.length} opiniones</p>
          </div>

          <div className="flex-1">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = reviews.filter((review) => Number(review.rating) === rating).length;
              const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={rating} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-muted-foreground">{rating}</span>
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-5 text-right text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col gap-3">
        {reviews.length > 0 ? reviews.map((review, index) => {
          const reviewer = review.reviewer_id ? reviewerMap.get(review.reviewer_id) : null;
          const listing = review.listing_id ? listingMap.get(review.listing_id) : null;
          const reviewerName = reviewer?.full_name?.trim() || "Usuario de Wetudy";

          return (
            <Card key={`${review.reviewer_id || "review"}-${review.created_at || index}`} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-sm text-primary">{getInitials(reviewerName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{reviewerName}</p>
                      <span className="text-xs text-muted-foreground">{review.created_at ? new Date(review.created_at).toLocaleDateString("es-ES") : "Sin fecha"}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < Number(review.rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">{review.comment?.trim() || "Sin comentario adicional."}</p>
                    {listing ? (
                      <Link href={`/marketplace/listing/${listing.id}`}>
                        <Badge variant="outline" className="mt-2 cursor-pointer gap-1 text-xs hover:bg-muted">{listing.title || "Anuncio"}</Badge>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed py-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">Todavía no tienes opiniones. Completa tu primera venta para empezar a generar reputación.</p>
          </div>
        )}
      </div>
    </div>
  );
}
