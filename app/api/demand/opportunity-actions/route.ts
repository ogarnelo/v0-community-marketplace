import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanDemandMetadata, normalizeDemandOptional, normalizeDemandText } from "@/lib/demand/normalize";

const ACTION_TYPES = new Set([
  "viewed",
  "publish_clicked",
  "business_contact_clicked",
  "saved_for_later",
  "dismissed",
  "campaign_created",
  "supplier_outreach",
]);

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const actionType = typeof body?.actionType === "string" ? body.actionType.trim() : "";
  const opportunityKey = normalizeDemandText(body?.opportunityKey, 180);

  if (!opportunityKey || !ACTION_TYPES.has(actionType)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.from("demand_opportunity_actions").insert({
    opportunity_key: opportunityKey,
    actor_id: user.id,
    action_type: actionType,
    role_context: normalizeDemandOptional(body?.roleContext, 40),
    metadata: cleanDemandMetadata(body?.metadata),
  });

  if (error) {
    console.error("demand_opportunity_action_error", error);
    return NextResponse.json({ error: "No se pudo registrar la acción." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
