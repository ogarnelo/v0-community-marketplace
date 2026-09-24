import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { attributeNeedToConversation } from "@/lib/demand/need-attribution";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
    if (!listingId || !conversationId) {
      return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
    }

    const admin = createAdminClient();
    const result = await attributeNeedToConversation(admin, {
      userId: user.id,
      listingId,
      conversationId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("No se pudo atribuir el contacto a una necesidad", error);
    return NextResponse.json({ ok: false, error: "attribution_failed" }, { status: 500 });
  }
}
