import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import {
  activationMessage,
  findDemandOpportunity,
  findSupplyCandidates,
  opportunityMetadata,
} from "@/lib/admin/demand-opportunities";

const MAX_TARGETS = 20;

export async function POST(
  request: Request,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1);
    if (!roles?.length) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

    const { key } = await context.params;
    const body = await request.json().catch(() => ({}));
    const requested = Array.isArray(body?.targetUserIds)
      ? body.targetUserIds.filter((value: unknown): value is string => typeof value === "string").slice(0, MAX_TARGETS)
      : [];
    if (requested.length === 0) {
      return NextResponse.json({ error: "Selecciona al menos un candidato." }, { status: 400 });
    }

    const admin = createAdminClient();
    const opportunity = await findDemandOpportunity(admin, key);
    if (!opportunity) return NextResponse.json({ error: "Oportunidad no encontrada." }, { status: 404 });

    const candidates = await findSupplyCandidates(admin, opportunity);
    const allowed = new Set(candidates.map((candidate) => candidate.userId));
    const targets = Array.from(new Set(requested)).filter((id) => allowed.has(id));
    if (targets.length === 0) {
      return NextResponse.json({ error: "Los candidatos ya no son elegibles." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const message = activationMessage(opportunity);
    const metadata = opportunityMetadata(opportunity);

    const { error: campaignError } = await admin
      .from("demand_campaigns")
      .upsert({
        title: opportunity.title,
        opportunity_key: opportunity.key,
        school_id: opportunity.schoolId,
        category: opportunity.category,
        grade_level: opportunity.gradeLevel,
        isbn: opportunity.isbn,
        specific_type: opportunity.specificType,
        size_label: opportunity.sizeLabel,
        brand: opportunity.brand,
        model: opportunity.model,
        families_count: opportunity.familiesCount,
        searches_count: opportunity.searchesCount,
        supply_count: opportunity.supplyCount,
        first_seen_at: opportunity.firstSeenAt,
        last_seen_at: opportunity.lastSeenAt,
        priority: opportunity.familiesCount >= 3 && opportunity.supplyCount === 0 ? "high" : "medium",
        status: "sellers_contacted",
        recommended_action: "Activación manual in-app",
        metadata,
        created_by: user.id,
        updated_at: now,
      }, { onConflict: "opportunity_key" });
    if (campaignError) throw campaignError;

    const activatedUserIds: string[] = [];
    for (const targetUserId of targets) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id,user_type")
        .eq("id", targetUserId)
        .maybeSingle();
      if (!profile || profile.user_type === "student") continue;

      const { data: existingAction } = await admin
        .from("demand_opportunity_actions")
        .select("id")
        .eq("opportunity_key", opportunity.key)
        .eq("target_user_id", targetUserId)
        .eq("action_type", "seller_contacted")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();
      if (existingAction) continue;

      const notification = await createNotification(admin, {
        user_id: targetUserId,
        kind: "supply_activation",
        title: "Hay familias buscando material que quizá tengas",
        body: message,
        href: `/supply-opportunity/${encodeURIComponent(opportunity.key)}`,
        metadata: {
          opportunity_key: opportunity.key,
          category: opportunity.category,
          school_id: opportunity.schoolId,
        },
      });
      if (notification.error) throw notification.error;

      const { error: actionError } = await admin
        .from("demand_opportunity_actions")
        .insert({
          opportunity_key: opportunity.key,
          actor_id: user.id,
          target_user_id: targetUserId,
          action_type: "seller_contacted",
          role_context: "super_admin",
          channel: "in_app",
          message,
          sent_at: now,
          metadata,
        });
      if (actionError) throw actionError;
      activatedUserIds.push(targetUserId);
    }

    return NextResponse.json({ ok: true, activatedUserIds });
  } catch (error: any) {
    console.error("Error activando oferta manual:", error);
    return NextResponse.json({ error: error?.message || "No se pudo activar la oferta." }, { status: 500 });
  }
}
