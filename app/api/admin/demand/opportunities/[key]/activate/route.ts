import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  activationMessage,
  findDemandOpportunity,
  revalidateSupplyTargets,
  demandIsSatisfied,
  opportunityMetadata,
} from "@/lib/admin/demand-opportunities";

const MAX_TARGETS = 20;

export async function POST(
  request: Request,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const missingSession = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return privateJson(
        { error: missingSession ? "No autenticado." : "No se pudo comprobar tu sesión." },
        { status: missingSession ? 401 : 503 }
      );
    }
    const user = authData?.user ?? null;
    if (!user) return privateJson({ error: "No autenticado." }, { status: 401 });

    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1);
    if (roleError) return privateJson({ error: "No se pudo comprobar tu permiso." }, { status: 503 });
    if (!roles?.length) return privateJson({ error: "No autorizado." }, { status: 403 });

    const { key } = await context.params;
    const body = await request.json().catch(() => ({}));
    const requested = Array.isArray(body?.targetUserIds) ? body.targetUserIds : [];
    if (requested.length > MAX_TARGETS || requested.some((id: unknown) =>
      typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
      return privateJson({ error: "Máximo 20 identificadores válidos." }, { status: 400 });
    }
    if (requested.length === 0) {
      return privateJson({ error: "Selecciona al menos un candidato." }, { status: 400 });
    }

    const admin = createAdminClient();
    const opportunity = await findDemandOpportunity(admin, key);
    if (!opportunity) return privateJson({ error: "Oportunidad no encontrada." }, { status: 404 });

    if (demandIsSatisfied(opportunity)) {
      return privateJson({ error:"Esta demanda ya está cubierta o cerrada." }, { status:409 });
    }
    // Recheck concrete recipients, independent of the admin's visible page/cursor.
    const targets = await revalidateSupplyTargets(admin, opportunity, requested);
    if (targets.length === 0) {
      return privateJson({ error: "Los candidatos ya no son elegibles." }, { status: 409 });
    }

    const message = activationMessage(opportunity);
    const metadata = opportunityMetadata(opportunity);

    const campaign = {
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
        metadata,
    };
    const activatedUserIds: string[] = [];
    for (const targetUserId of targets) {
      const result = await admin.rpc("activate_supply_recipient_v2", {
        p_actor: user.id, p_target: targetUserId, p_campaign: campaign,
        p_message: message, p_href: `/supply-opportunity/${encodeURIComponent(opportunity.key)}`,
      });
      if (result.error) throw result.error;
      if (result.data === true) activatedUserIds.push(targetUserId);
    }
    if (!activatedUserIds.length) return privateJson({error:"No quedan candidatos elegibles."},{status:409});

    return privateJson({ ok: true, activatedUserIds });
  } catch {
    console.error("demand_opportunity_activation_failed");
    return privateJson({ error: "No se pudo activar la oferta." }, { status: 500 });
  }
}
