import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, {
    ...options,
    headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) },
  });
}

import { attributeNeedToConversation } from "@/lib/demand/need-attribution";

export async function POST(request: Request) {
  try {
    let authResult;
    try {
      const supabase = await createClient();
      authResult = await supabase.auth.getUser();
    } catch {
      return privateJson({ ok: false, error: "auth_unavailable" }, { status: 503 });
    }
    if (authResult.error) {
      const guest = authResult.error.name === "AuthSessionMissingError" ||
        authResult.error.code === "session_not_found";
      return privateJson({ ok: false, error: guest ? "auth_required" : "auth_unavailable" },
        { status: guest ? 401 : 503 });
    }
    const user = authResult.data?.user ?? null;
    if (!user) return privateJson({ ok: false, error: "auth_required" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
    if (!listingId || !conversationId) {
      return privateJson({ ok: false, error: "missing_fields" }, { status: 400 });
    }

    const admin = createAdminClient();
    const result = await attributeNeedToConversation(admin, {
      userId: user.id,
      listingId,
      conversationId,
    });

    return privateJson({ ok: true, ...result });
  } catch {
    console.error("demand_contact_attribution_failed");
    return privateJson({ ok: false, error: "attribution_failed" }, { status: 500 });
  }
}
