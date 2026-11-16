import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestDonationFlow } from "@/lib/services/donations.service";
import { attributeNeedToConversation } from "@/lib/demand/need-attribution";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const noSession = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return privateJson(
        { error: noSession ? "No autenticado." : "No se pudo comprobar tu sesión." },
        { status: noSession ? 401 : 503 }
      );
    }
    const user = authData?.user ?? null;

    if (!user) {
      return privateJson({ error: "No autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";

    if (!listingId) {
      return privateJson({ error: "Falta el anuncio." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const result = await requestDonationFlow({
      supabase: adminSupabase,
      listingId,
      actorUserId: user.id,
      note,
    });

    try {
      await attributeNeedToConversation(adminSupabase, {
        userId: user.id,
        listingId,
        conversationId: result.conversationId,
      });
    } catch {
      console.error("donation_need_attribution_failed");
    }

    return privateJson({ ok: true, ...result });
  } catch (error: unknown) {
    const name = error && typeof error === "object" && "name" in error ? error.name : null;
    if (name === "DonationRequestConflictError") {
      return privateJson({ error: "Ya has solicitado esta donación." }, { status: 409 });
    }
    if (name === "DonationRequestReconciliationError") {
      return privateJson(
        { error: "La solicitud se guardó, pero requiere conciliar el chat o la notificación." },
        { status: 503 }
      );
    }
    console.error("donation_request_failed");
    return privateJson({ error: "No se pudo crear la solicitud." }, { status: 500 });
  }
}
