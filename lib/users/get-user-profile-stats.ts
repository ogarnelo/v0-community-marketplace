import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListingRow, ReviewRow } from "@/lib/types/marketplace";
import { deriveBadges } from "@/lib/users/badges";

export async function getUserProfileStats(supabase: SupabaseClient, userId: string) {
  const [{ data: reviewsData }, { data: listingsData }] = await Promise.all([
    supabase
      .from("reviews")
      .select("rating, comment, created_at, reviewer_id, reviewed_user_id, listing_id")
      .eq("reviewed_user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("listings")
      .select("id, listing_type, status")
      .eq("seller_id", userId),
  ]);

  const reviews = (reviewsData || []) as ReviewRow[];
  const listings = (listingsData || []) as Pick<ListingRow, "id" | "status" | "listing_type">[];

  const reviewCount = reviews.length;
  const averageRating =
    reviewCount > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount : null;
  const activeListingsCount = listings.filter((listing) => listing.status === "available").length;
  const soldListingsCount = listings.filter((listing) => listing.status === "sold").length;
  const donationListingsCount = listings.filter((listing) => listing.listing_type === "donation").length;

  return {
    reviews,
    reviewCount,
    averageRating,
    activeListingsCount,
    soldListingsCount,
    donationListingsCount,
    badgesForUserType: (userType?: string | null) =>
      deriveBadges({
        userType,
        reviewCount,
        averageRating,
        activeListingsCount,
        soldListingsCount,
        donationListingsCount,
      }),
  };
}
