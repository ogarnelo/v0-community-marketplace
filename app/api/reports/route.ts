import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_REPORTS_PER_HOUR = 10;
const MAX_DETAILS_LENGTH = 1000;

const LISTING_REASONS = new Set([
  "spam",
  "fraude",
  "descripcion_enganosa",
  "contenido_inapropiado",
  "otro",
]);

const CONVERSATION_REASONS = new Set([
  "spam",
  "fraude",
  "acoso",
  "contenido_inapropiado",
  "otro",
]);

type ReportTargetType = "listing" | "conversation";

function isTargetType(value: unknown): value is ReportTargetType {
  return value === "listing" || value === "conversation";
}

function isAllowedReason(targetType: ReportTargetType, reason: string) {
  return targetType === "listing"
    ? LISTING_REASONS.has(reason)
    : CONVERSATION_REASONS.has(reason);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Confirma tu email antes de enviar un reporte." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const targetType = isTargetType(body?.targetType) ? body.targetType : null;
    const targetId = typeof body?.targetId === "string" ? body.targetId.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    const details =
      typeof body?.details === "string"
        ? body.details.trim().slice(0, MAX_DETAILS_LENGTH)
        : "";

    if (!targetType || !targetId || !reason || !isAllowedReason(targetType, reason)) {
      return NextResponse.json({ error: "El reporte no es válido." }, { status: 400 });
    }

    const admin = createAdminClient();

    if (targetType === "listing") {
      const { data: listing, error: listingError } = await admin
        .from("listings")
        .select("id")
        .eq("id", targetId)
        .maybeSingle();

      if (listingError) throw listingError;
      if (!listing) {
        return NextResponse.json({ error: "El anuncio ya no existe." }, { status: 404 });
      }
    } else {
      const { data: conversation, error: conversationError } = await admin
        .from("conversations")
        .select("id, buyer_id, seller_id")
        .eq("id", targetId)
        .maybeSingle();

      if (conversationError) throw conversationError;
      if (!conversation) {
        return NextResponse.json({ error: "La conversación ya no existe." }, { status: 404 });
      }

      if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) {
        return NextResponse.json(
          { error: "No tienes permisos para reportar esta conversación." },
          { status: 403 }
        );
      }
    }

    let duplicateQuery = admin
      .from("reports")
      .select("id, status")
      .eq("reporter_id", user.id)
      .eq("target_type", targetType)
      .in("status", ["open", "reviewing"])
      .limit(1);

    duplicateQuery =
      targetType === "listing"
        ? duplicateQuery.eq("listing_id", targetId)
        : duplicateQuery.eq("conversation_id", targetId);

    const { data: duplicate, error: duplicateError } = await duplicateQuery.maybeSingle();

    if (duplicateError) throw duplicateError;
    if (duplicate?.id) {
      return NextResponse.json({ ok: true, alreadyExists: true, reportId: duplicate.id });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", user.id)
      .gte("created_at", oneHourAgo);

    if (countError) throw countError;

    if ((count || 0) >= MAX_REPORTS_PER_HOUR) {
      return NextResponse.json(
        {
          error:
            "Has enviado varios reportes en poco tiempo. Inténtalo de nuevo más adelante.",
        },
        { status: 429 }
      );
    }

    const payload =
      targetType === "listing"
        ? {
            reporter_id: user.id,
            target_type: "listing",
            listing_id: targetId,
            reason,
            details: details || null,
          }
        : {
            reporter_id: user.id,
            target_type: "conversation",
            conversation_id: targetId,
            reason,
            details: details || null,
          };

    const { data: report, error: insertError } = await admin
      .from("reports")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ ok: true, alreadyExists: true });
      }
      throw insertError;
    }

    return NextResponse.json({ ok: true, reportId: report.id });
  } catch (error: any) {
    console.error("Error creando reporte de moderación:", error);

    return NextResponse.json(
      { error: error?.message || error?.details || "No se pudo enviar el reporte." },
      { status: 500 }
    );
  }
}
