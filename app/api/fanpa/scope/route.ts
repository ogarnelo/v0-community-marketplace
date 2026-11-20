import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveFederationRepresentation } from "@/lib/fanpa/federation-representation";

export const dynamic = "force-dynamic";
const PRIVATE = { "Cache-Control": "private, no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LINKS = 100;
function respond(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: PRIVATE });
}

/**
 * Internal capability discovery only: IDs/names of represented schools.
 * No KPI or user data. Feature flag must remain OFF until approved pilot.
 * Never trust a supplied federation ID as proof of membership.
 */
export async function GET(request: Request) {
  if (process.env.WETUDY_FANPA_REPORTING_ENABLED !== "true") {
    return respond({ error: "feature_disabled" }, 404);
  }
  try {
    const { searchParams } = new URL(request.url);
    const federationId = searchParams.get("federationId");
    if (!federationId || !UUID.test(federationId)) {
      return respond({ error: "invalid_federation_id" }, 400);
    }
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const missing = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return respond({ error: missing ? "auth_required" : "auth_unavailable" },
        missing ? 401 : 503);
    }
    const user = authData?.user;
    if (!user || !user.email_confirmed_at) return respond({ error: "auth_required" }, 401);

    const admin = createAdminClient();
    const [federations, members, links] = await Promise.all([
      admin.from("fanpa_federations").select("id,is_active,is_test")
        .eq("id", federationId).limit(2),
      admin.from("fanpa_administrators").select("federation_id,user_id,active")
        .eq("federation_id", federationId).eq("user_id", user.id).limit(2),
      admin.from("fanpa_represented_schools").select("federation_id,school_id,active")
        .eq("federation_id", federationId).limit(MAX_LINKS + 1),
    ]);
    if (federations.error || members.error || links.error ||
        !Array.isArray(federations.data) || !Array.isArray(members.data) ||
        !Array.isArray(links.data) || links.data.length > MAX_LINKS) {
      return respond({ error: "scope_unavailable" }, 503);
    }
    // Reject absent, revoked or duplicate membership *before* reading schools.
    if (federations.data.length !== 1 ||
        federations.data[0].is_active !== true ||
        federations.data[0].is_test === true ||
        members.data.length !== 1 || members.data[0].active !== true) {
      return respond({ error: "scope_forbidden" }, 403);
    }
    const activeIds = [...new Set(links.data.filter(link => link.active === true)
      .map(link => link.school_id))];
    if (activeIds.length === 0) return respond({ error: "scope_forbidden" }, 403);

    const schools = await admin.from("schools").select("id,name,is_active,is_test")
      .in("id", activeIds).limit(MAX_LINKS + 1);
    if (schools.error || !Array.isArray(schools.data) ||
        schools.data.length > MAX_LINKS) {
      return respond({ error: "scope_unavailable" }, 503);
    }
    const scope = resolveFederationRepresentation({
      authenticatedUserId: user.id, requestedFederationId: federationId,
      federations: federations.data, administratorLinks: members.data,
      schoolLinks: links.data, schools: schools.data,
    });
    if (!scope.authorized) return respond({ error: "scope_forbidden" }, 403);

    // Revalidate the member link and federation state before returning.
    // Never cache results: a revocation is expected to take effect on refresh.
    const [freshAuth, freshFederation, freshMember, freshLinks] = await Promise.all([
      supabase.auth.getUser(),
      admin.from("fanpa_federations").select("id,is_active,is_test")
        .eq("id", federationId).limit(2),
      admin.from("fanpa_administrators").select("federation_id,user_id,active")
        .eq("federation_id", federationId).eq("user_id", user.id).limit(2),
      admin.from("fanpa_represented_schools").select("federation_id,school_id,active")
        .eq("federation_id", federationId).limit(MAX_LINKS + 1),
    ]);
    if (freshAuth.error || freshFederation.error || freshMember.error ||
        freshLinks.error || !Array.isArray(freshFederation.data) ||
        !Array.isArray(freshMember.data) || !Array.isArray(freshLinks.data) ||
        freshLinks.data.length > MAX_LINKS) {
      return respond({ error: "scope_unavailable" }, 503);
    }
    if (!freshAuth.data.user || freshAuth.data.user.id !== user.id ||
        !freshAuth.data.user.email_confirmed_at ||
        freshFederation.data.length !== 1 ||
        freshFederation.data[0].is_active !== true ||
        freshFederation.data[0].is_test === true ||
        freshMember.data.length !== 1 || freshMember.data[0].active !== true) {
      return respond({ error: "scope_forbidden" }, 403);
    }
    const freshIds = [...new Set(freshLinks.data.filter(link => link.active === true)
      .map(link => link.school_id))].sort();
    if (freshIds.length !== scope.representedSchoolIds.length ||
        freshIds.some((id, index) => id !== scope.representedSchoolIds[index])) {
      return respond({ error: "scope_changed" }, 409);
    }
    const byId = new Map(schools.data.map(school => [school.id, school]));
    return respond({
      federationId: scope.federationId,
      schools: scope.representedSchoolIds.map(id => ({
        id, name: byId.get(id)?.name,
      })),
    }, 200);
  } catch {
    console.error("fanpa_scope_read_failed");
    return respond({ error: "scope_unavailable" }, 503);
  }
}
