import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FANPA_UUID, readAuthorizedFederationScope, sameFederationScope,
} from "@/lib/fanpa/federation-server-scope";
import { readScopedFederationActivityCounts } from "@/lib/fanpa/federation-scoped-activity-reader";
import { projectVerifiedFederationKpis } from "@/lib/fanpa/federation-kpi-response-guard";

export const dynamic = "force-dynamic";
const PRIVATE = { "Cache-Control": "private, no-store" };

function respond(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: PRIVATE });
}

/**
 * KPI endpoint is dormant until BOTH independent flags are set.
 * No client-supplied list of schools is trusted; read representation
 * from service-only tables and re-check it after generating the counts.
 */
export async function GET(request: Request) {
  if (process.env.WETUDY_FANPA_REPORTING_ENABLED !== "true" ||
      process.env.WETUDY_FANPA_KPI_ENABLED !== "true") {
    return respond({ error: "feature_disabled" }, 404);
  }
  try {
    const params = new URL(request.url).searchParams;
    const federationId = params.get("federationId");
    const selectedSchoolId = params.get("schoolId");
    if (!federationId || !FANPA_UUID.test(federationId) ||
        (selectedSchoolId !== null && !FANPA_UUID.test(selectedSchoolId))) {
      return respond({ error: "invalid_scope_id" }, 400);
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
    if (!user || !user.email_confirmed_at) {
      return respond({ error: "auth_required" }, 401);
    }
    const admin = createAdminClient();
    const initial = await readAuthorizedFederationScope(admin, federationId, user.id);
    if (!initial.ok) return respond({ error: initial.error }, initial.status);
    if (selectedSchoolId && !initial.scope.schoolIds.includes(selectedSchoolId)) {
      return respond({ error: "scope_forbidden" }, 403);
    }

    const schoolIds = selectedSchoolId ? [selectedSchoolId] : initial.scope.schoolIds;
    // The reader runs server-only HEAD count queries with exact school_id
    // filtering and suppresses ALL small-cohort activity and inferable totals.
    const kpis = await readScopedFederationActivityCounts(schoolIds);

    // Provider errors and revocations must not return stale private data.
    const { data: freshAuth, error: freshAuthError } = await supabase.auth.getUser();
    if (freshAuthError) return respond({ error: "scope_unavailable" }, 503);
    if (!freshAuth?.user || freshAuth.user.id !== user.id ||
        !freshAuth.user.email_confirmed_at) {
      return respond({ error: "scope_forbidden" }, 403);
    }
    const fresh = await readAuthorizedFederationScope(admin, federationId, user.id);
    if (!fresh.ok) return respond({ error: fresh.error }, fresh.status);
    if (!sameFederationScope(initial.scope, fresh.scope)) {
      return respond({ error: "scope_changed" }, 409);
    }
    // Fail closed if the server reader returns a foreign/duplicate school,
    // a malformed count or any aggregate that could reveal a small cohort.
    // Explicit wire projection prevents accidental serialization of fields
    // introduced by future privileged reader changes.
    const safe = projectVerifiedFederationKpis(
      kpis, schoolIds, fresh.scope.schools,
    );
    return respond({
      federationId,
      selectedSchoolId,
      totalSchools: safe.totalSchools,
      uniqueUsers: safe.uniqueUsers,
      students: safe.students,
      activeListings: safe.activeListings,
      totalListings: safe.totalListings,
      openDemands: safe.openDemands,
      confirmedExchanges: safe.confirmedExchanges,
      schools: safe.schools,
    }, 200);
  } catch {
    console.error("fanpa_kpi_read_unavailable");
    return respond({ error: "scope_unavailable" }, 503);
  }
}
