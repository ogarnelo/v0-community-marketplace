import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListingRow } from "@/lib/types/marketplace";
import { deriveBadges } from "@/lib/users/badges";
import { getUserReviews } from "@/lib/users/get-user-reviews";

export async function getUserProfileStats(supabase: SupabaseClient, userId: string) {
  const [reviews, { data: listingsData }] = await Promise.all([
    getUserReviews(supabase, userId),
    supabase
      .from("listings")
      .select("id, listing_type, status")
      .eq("seller_id", userId),
  ]);

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
