import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STALE_CONVERSATION_DAYS = 7;

const BUYER_REASONS = new Set([
  "bought_here",
  "unavailable",
  "seller_no_response",
  "price",
  "distance",
  "found_other",
  "no_longer_needed",
  "other",
]);

const SELLER_REASONS = new Set([
  "sold_here",
  "sold_elsewhere",
  "still_available",
  "buyer_no_response",
  "price",
  "decided_not_to_sell",
  "other",
]);

function cleanDetails(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const conversationId =
      typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (!conversationId || !reason) {
      return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
    }

    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, buyer_id, seller_id, updated_at")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json({ ok: false, error: "conversation_not_found" }, { status: 404 });
    }

    const role =
      conversation.buyer_id === user.id
        ? "buyer"
        : conversation.seller_id === user.id
          ? "seller"
          : null;

    if (!role) {
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 });
    }

    const allowedReasons = role === "buyer" ? BUYER_REASONS : SELLER_REASONS;
    if (!allowedReasons.has(reason)) {
      return NextResponse.json({ ok: false, error: "invalid_reason" }, { status: 400 });
    }

    const { data: latestMessage } = await supabase
      .from("messages")
      .select("created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastActivityAt = latestMessage?.created_at || conversation.updated_at;
    const lastActivityMs = lastActivityAt ? new Date(lastActivityAt).getTime() : Number.NaN;
    const staleThresholdMs = STALE_CONVERSATION_DAYS * 24 * 60 * 60 * 1000;

    if (!Number.isFinite(lastActivityMs) || Date.now() - lastActivityMs < staleThresholdMs) {
      return NextResponse.json({ ok: false, error: "conversation_not_stale" }, { status: 409 });
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin
      .from("conversation_outcome_feedback")
      .upsert(
        {
          conversation_id: conversation.id,
          user_id: user.id,
          feedback_role: role,
          reason,
          details: cleanDetails(body?.details),
          updated_at: now,
        },
        { onConflict: "conversation_id,user_id" }
      );

    if (error) {
      console.error("Error guardando el resultado de la conversación:", error);
      return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error inesperado guardando feedback de conversación:", error);
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
