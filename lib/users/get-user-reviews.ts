import type { SupabaseClient } from "@supabase/supabase-js";

export type UnifiedUserReview = {
  id: string;
  source: "agreement" | "legacy" | "commerce";
  rating: number;
  comment: string | null;
  created_at: string | null;
  reviewer_id: string | null;
  reviewed_user_id: string | null;
  listing_id: string | null;
};

type ReviewResult = {
  data: any[] | null;
  error: { message?: string } | null;
};

function normalizeRows(
  rows: any[] | null,
  source: UnifiedUserReview["source"]
): UnifiedUserReview[] {
  return (rows || [])
    .filter((row) => Number.isFinite(Number(row.rating)))
    .map((row) => ({
      id: String(row.id),
      source,
      rating: Number(row.rating),
      comment: typeof row.comment === "string" ? row.comment : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
      reviewer_id: typeof row.reviewer_id === "string" ? row.reviewer_id : null,
      reviewed_user_id:
        typeof row.reviewed_user_id === "string" ? row.reviewed_user_id : null,
      listing_id: typeof row.listing_id === "string" ? row.listing_id : null,
    }));
}

export async function getUserReviews(
  supabase: SupabaseClient,
  userId: string
): Promise<UnifiedUserReview[]> {
  const [agreementResult, legacyResult, commerceResult] = (await Promise.all([
    supabase
      .from("agreement_reviews")
      .select("id, rating, comment, created_at, reviewer_id, reviewed_user_id, listing_id, status")
      .eq("reviewed_user_id", userId)
      .eq("status", "published")
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, reviewer_id, reviewed_user_id, listing_id")
      .eq("reviewed_user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("transaction_reviews")
      .select("id, rating, comment, created_at, reviewer_id, reviewed_user_id")
      .eq("reviewed_user_id", userId)
      .order("created_at", { ascending: false }),
  ])) as ReviewResult[];

  if (agreementResult.error) {
    console.error("No se pudieron cargar agreement_reviews:", agreementResult.error.message);
  }
  if (legacyResult.error) {
    console.error("No se pudieron cargar reviews legacy:", legacyResult.error.message);
  }
  if (commerceResult.error) {
    console.error("No se pudieron cargar transaction_reviews:", commerceResult.error.message);
  }

  return [
    ...normalizeRows(agreementResult.data, "agreement"),
    ...normalizeRows(legacyResult.data, "legacy"),
    ...normalizeRows(commerceResult.data, "commerce"),
  ].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
}
