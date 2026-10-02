import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type FulfilledCourseNeedSummary = {
  id: string;
  student_id: string;
  title: string;
  isbn: string | null;
  category: string;
  academic_year: string;
  demand_request_id: string | null;
  fulfilled_at: string;
  listing_id: string | null;
  listing_title: string | null;
  listing_status: string | null;
  agreement_id: string | null;
  agreement_type: string | null;
  agreement_amount: number | null;
  agreement_confirmed_at: string | null;
  conversation_id: string | null;
};

export async function listFulfilledCourseNeeds(
  userId: string
): Promise<FulfilledCourseNeedSummary[]> {
  const admin = createAdminClient();
  const { data: needs, error: needsError } = await admin
    .from("course_needs")
    .select(
      "id, student_id, title, isbn, category, academic_year, demand_request_id, created_at, updated_at"
    )
    .eq("owner_user_id", userId)
    .eq("status", "fulfilled")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (needsError) throw needsError;
  if (!needs?.length) return [];

  const demandIds = Array.from(
    new Set(
      needs
        .map((need: any) => need.demand_request_id)
        .filter((id: string | null): id is string => Boolean(id))
    )
  );

  let demands: any[] = [];
  if (demandIds.length > 0) {
    const { data, error } = await admin
      .from("demand_requests")
      .select(
        "id, resolved_at, confirmed_agreement_id, matched_listing_id, conversation_id"
      )
      .eq("user_id", userId)
      .eq("source", "course_need")
      .in("id", demandIds);

    if (error) throw error;
    demands = data || [];
  }

  const agreementIds = Array.from(
    new Set(
      demands
        .map((demand: any) => demand.confirmed_agreement_id)
        .filter((id: string | null): id is string => Boolean(id))
    )
  );

  let agreements: any[] = [];
  if (agreementIds.length > 0) {
    const { data, error } = await admin
      .from("agreements")
      .select(
        "id, listing_id, conversation_id, agreement_type, status, amount, confirmed_at, demand_request_id"
      )
      .eq("status", "confirmed")
      .in("id", agreementIds);

    if (error) throw error;
    agreements = data || [];
  }

  const demandById = new Map(demands.map((demand: any) => [demand.id, demand]));
  const agreementById = new Map(
    agreements.map((agreement: any) => [agreement.id, agreement])
  );

  const listingIds = Array.from(
    new Set(
      demands
        .flatMap((demand: any) => {
          const agreement = demand.confirmed_agreement_id
            ? agreementById.get(demand.confirmed_agreement_id)
            : null;
          return [agreement?.listing_id, demand.matched_listing_id];
        })
        .filter((id: string | null | undefined): id is string => Boolean(id))
    )
  );

  let listings: any[] = [];
  if (listingIds.length > 0) {
    const { data, error } = await admin
      .from("listings")
      .select("id, title, status")
      .in("id", listingIds);

    if (error) throw error;
    listings = data || [];
  }

  const listingById = new Map(
    listings.map((listing: any) => [listing.id, listing])
  );

  return needs.map((need: any) => {
    const demand = need.demand_request_id
      ? demandById.get(need.demand_request_id) || null
      : null;
    const agreement = demand?.confirmed_agreement_id
      ? agreementById.get(demand.confirmed_agreement_id) || null
      : null;
    const listingId = agreement?.listing_id || demand?.matched_listing_id || null;
    const listing = listingId ? listingById.get(listingId) || null : null;
    const rawAmount = agreement?.amount;
    const agreementAmount =
      rawAmount == null || Number.isNaN(Number(rawAmount))
        ? null
        : Number(rawAmount);

    return {
      id: need.id,
      student_id: need.student_id,
      title: need.title,
      isbn: need.isbn || null,
      category: need.category,
      academic_year: need.academic_year,
      demand_request_id: need.demand_request_id || null,
      fulfilled_at:
        agreement?.confirmed_at ||
        demand?.resolved_at ||
        need.updated_at ||
        need.created_at,
      listing_id: listing?.id || listingId,
      listing_title: listing?.title || null,
      listing_status: listing?.status || null,
      agreement_id: agreement?.id || null,
      agreement_type: agreement?.agreement_type || null,
      agreement_amount: agreementAmount,
      agreement_confirmed_at: agreement?.confirmed_at || null,
      conversation_id:
        agreement?.conversation_id || demand?.conversation_id || null,
    };
  });
}
