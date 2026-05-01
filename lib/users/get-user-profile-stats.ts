import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListingRow, ReviewRow } from "@/lib/types/marketplace";
import { deriveBadges } from "@/lib/users/badges";

async function loadReviews(supabase: SupabaseClient, userId: string) {
  try {
    const { data, error } = await supabase
      .from("transaction_reviews")
      .select("rating, comment, created_at, reviewer_id, reviewed_user_id")
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

async function loadListings(supabase: SupabaseClient, userId: string) {
  try {
    const { data } = await supabase
      .from("listings")
      .select("id, listing_type, type, status")
      .eq("seller_id", userId);
    return (data || []) as Pick<ListingRow, "id" | "status" | "listing_type" | "type">[];
  } catch {
    return [] as Pick<ListingRow, "id" | "status" | "listing_type" | "type">[];
  }
}

async function loadPurchases(supabase: SupabaseClient, userId: string) {
  try {
    const { data } = await supabase
      .from("payment_intents")
      .select("id")
      .eq("buyer_id", userId)
      .eq("status", "paid");
    return data?.length || 0;
  } catch {
    return 0;
  }
}

export async function getUserProfileStats(supabase: SupabaseClient, userId: string) {
  const [reviews, listings, purchasesCount] = await Promise.all([
    loadReviews(supabase, userId),
    loadListings(supabase, userId),
    loadPurchases(supabase, userId),
  ]);

  const reviewCount = reviews.length;
  const averageRating =
    reviewCount > 0 ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviewCount : null;
  const activeListingsCount = listings.filter((listing) => listing.status === "available").length;
  const soldListingsCount = listings.filter((listing) => listing.status === "sold").length;
  const donationListingsCount = listings.filter(
    (listing) => listing.listing_type === "donation" || listing.type === "donation"
  ).length;

  return {
    reviews,
    reviewCount,
    averageRating,
    activeListingsCount,
    soldListingsCount,
    donationListingsCount,
    purchasesCount,
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
