import "server-only";

import { normalizeIsbn } from "@/lib/books/isbn";

function normalizeText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameText(left?: string | null, right?: string | null) {
  const a = normalizeText(left);
  const b = normalizeText(right);
  return Boolean(a && b && a === b);
}

function canonicalIsbn(value?: string | null) {
  if (!value) return null;
  return normalizeIsbn(value)?.canonicalIsbn || null;
}

function structuredNeedMatchesListing(need: any, listing: any) {
  const needIsbn = canonicalIsbn(need.isbn);
  const listingIsbn = canonicalIsbn(listing.isbn);
  if (needIsbn) return Boolean(listingIsbn && needIsbn === listingIsbn);

  if (!need.school_id || !need.category) return false;
  if (listing.school_id !== need.school_id) return false;
  if (!sameText(listing.category, need.category)) return false;
  if (need.grade_level && listing.grade_level && !sameText(listing.grade_level, need.grade_level)) return false;
  return true;
}

async function loadNeed(admin: any, needId: string) {
  const { data } = await admin
    .from("demand_requests")
    .select("id,user_id,status,first_result_at,first_contact_at,first_agreement_at,resolved_at,matched_listing_id,conversation_id,confirmed_agreement_id")
    .eq("id", needId)
    .maybeSingle();
  return data || null;
}

export async function recordNeedResult(
  admin: any,
  params: { needId: string; listingId: string; observedAt?: string }
) {
  const need = await loadNeed(admin, params.needId);
  if (!need) return false;

  const observedAt = params.observedAt || new Date().toISOString();
  const updates: Record<string, unknown> = {};
  if (!need.first_result_at) updates.first_result_at = observedAt;
  if (!need.matched_listing_id) updates.matched_listing_id = params.listingId;
  if (need.status === "open") updates.status = "matched";
  if (Object.keys(updates).length === 0) return true;

  const { error } = await admin.from("demand_requests").update(updates).eq("id", need.id);
  if (error) throw error;
  return true;
}

async function strongSavedSearchNeedIds(admin: any, userId: string, listingId: string) {
  const { data: matches } = await admin
    .from("saved_search_matches")
    .select("saved_search_id")
    .eq("user_id", userId)
    .eq("listing_id", listingId)
    .limit(50);

  const savedSearchIds = Array.from(new Set((matches || []).map((row: any) => row.saved_search_id).filter(Boolean)));
  if (savedSearchIds.length === 0) return [];

  const { data: searches } = await admin
    .from("saved_searches")
    .select("demand_request_id")
    .in("id", savedSearchIds)
    .not("demand_request_id", "is", null);

  return Array.from(new Set((searches || []).map((row: any) => row.demand_request_id).filter(Boolean)));
}

export async function attributeNeedToConversation(
  admin: any,
  params: { userId: string; listingId: string; conversationId: string }
) {
  const { data: conversation } = await admin
    .from("conversations")
    .select("id,listing_id,buyer_id,demand_request_id,created_at")
    .eq("id", params.conversationId)
    .maybeSingle();

  if (!conversation || conversation.buyer_id !== params.userId || conversation.listing_id !== params.listingId) {
    return { attributed: false, reason: "conversation_mismatch" as const };
  }
  if (conversation.demand_request_id) {
    return { attributed: true, needId: conversation.demand_request_id, reason: "already_attributed" as const };
  }

  const { data: listing } = await admin
    .from("listings")
    .select("id,isbn,category,grade_level,school_id")
    .eq("id", params.listingId)
    .maybeSingle();
  if (!listing) return { attributed: false, reason: "listing_missing" as const };

  let candidateIds = await strongSavedSearchNeedIds(admin, params.userId, params.listingId);

  if (candidateIds.length === 0) {
    const { data: needs } = await admin
      .from("demand_requests")
      .select("id,user_id,status,isbn,category,grade_level,school_id,created_at")
      .eq("user_id", params.userId)
      .in("status", ["open", "matched"])
      .order("created_at", { ascending: false })
      .limit(100);

    candidateIds = (needs || [])
      .filter((need: any) => structuredNeedMatchesListing(need, listing))
      .map((need: any) => need.id);
  }

  candidateIds = Array.from(new Set(candidateIds));
  if (candidateIds.length !== 1) {
    return {
      attributed: false,
      reason: candidateIds.length > 1 ? "ambiguous" as const : "no_reliable_need" as const,
    };
  }

  const needId = candidateIds[0];
  const need = await loadNeed(admin, needId);
  if (!need) return { attributed: false, reason: "need_missing" as const };

  const contactAt = conversation.created_at || new Date().toISOString();
  const { error: conversationError } = await admin
    .from("conversations")
    .update({ demand_request_id: needId })
    .eq("id", conversation.id)
    .is("demand_request_id", null);
  if (conversationError) throw conversationError;

  const updates: Record<string, unknown> = {};
  if (!need.first_result_at) updates.first_result_at = contactAt;
  if (!need.first_contact_at) updates.first_contact_at = contactAt;
  if (!need.matched_listing_id) updates.matched_listing_id = listing.id;
  if (!need.conversation_id) updates.conversation_id = conversation.id;
  if (need.status === "open") updates.status = "matched";

  const { error: needError } = await admin.from("demand_requests").update(updates).eq("id", needId);
  if (needError) throw needError;

  return { attributed: true, needId, reason: "unique_reliable_match" as const };
}

export async function linkAgreementToNeed(
  admin: any,
  agreement: {
    id: string;
    conversation_id?: string | null;
    listing_id: string;
    buyer_id: string;
    seller_id: string;
    status: string;
    created_at?: string | null;
    confirmed_at?: string | null;
  }
) {
  if (!agreement.conversation_id) return null;

  await attributeNeedToConversation(admin, {
    userId: agreement.buyer_id,
    listingId: agreement.listing_id,
    conversationId: agreement.conversation_id,
  });

  const { data: conversation } = await admin
    .from("conversations")
    .select("demand_request_id")
    .eq("id", agreement.conversation_id)
    .maybeSingle();

  const needId = conversation?.demand_request_id || null;
  if (!needId) return null;

  const need = await loadNeed(admin, needId);
  if (!need) return null;

  const agreementAt = agreement.created_at || new Date().toISOString();
  const resolvedAt = agreement.confirmed_at || (agreement.status === "confirmed" ? new Date().toISOString() : null);

  const { error: agreementError } = await admin
    .from("agreements")
    .update({ demand_request_id: needId })
    .eq("id", agreement.id);
  if (agreementError) throw agreementError;

  const updates: Record<string, unknown> = {};
  if (!need.first_agreement_at) updates.first_agreement_at = agreementAt;
  if (resolvedAt && !need.resolved_at) updates.resolved_at = resolvedAt;
  if (resolvedAt && !need.confirmed_agreement_id) updates.confirmed_agreement_id = agreement.id;
  if (resolvedAt) updates.status = "matched";

  if (Object.keys(updates).length > 0) {
    const { error: needError } = await admin.from("demand_requests").update(updates).eq("id", needId);
    if (needError) throw needError;
  }

  if (resolvedAt) {
    const { data: actions } = await admin
      .from("demand_opportunity_actions")
      .select("opportunity_key")
      .eq("resulting_listing_id", agreement.listing_id)
      .eq("target_user_id", agreement.seller_id)
      .eq("action_type", "seller_contacted");

    const keys = Array.from(new Set((actions || []).map((row: any) => row.opportunity_key).filter(Boolean)));
    if (keys.length > 0) {
      const { error: campaignError } = await admin
        .from("demand_campaigns")
        .update({ status: "satisfied", updated_at: resolvedAt })
        .in("opportunity_key", keys)
        .in("status", ["sellers_contacted", "supply_generated"]);
      if (campaignError) throw campaignError;
    }
  }

  return needId;
}
