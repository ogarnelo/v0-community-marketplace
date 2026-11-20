import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FANPA_UUID, readAuthorizedFederationScope, sameFederationScope,
} from "@/lib/fanpa/federation-server-scope";

export const dynamic = "force-dynamic";
const PRIVATE = { "Cache-Control": "private, no-store" };

function respond(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: PRIVATE });
}

/** Federation school discovery only; no KPI, profile or student data. */
export async function GET(request: Request) {
  if (process.env.WETUDY_FANPA_REPORTING_ENABLED !== "true") {
    return respond({ error: "feature_disabled" }, 404);
  }
  try {
    const federationId = new URL(request.url).searchParams.get("federationId");
    if (!federationId || !FANPA_UUID.test(federationId)) {
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
    if (!user || !user.email_confirmed_at) {
      return respond({ error: "auth_required" }, 401);
    }
    const admin = createAdminClient();
    const initial = await readAuthorizedFederationScope(admin, federationId, user.id);
    if (!initial.ok) return respond({ error: initial.error }, initial.status);

    // Re-check identity, representation, revocation and school activity
    // immediately before returning any federation information.
    const { data: freshAuth, error: freshError } = await supabase.auth.getUser();
    if (freshError) return respond({ error: "scope_unavailable" }, 503);
    if (!freshAuth?.user || freshAuth.user.id !== user.id ||
        !freshAuth.user.email_confirmed_at) {
      return respond({ error: "scope_forbidden" }, 403);
    }
    const current = await readAuthorizedFederationScope(admin, federationId, user.id);
    if (!current.ok) return respond({ error: current.error }, current.status);
    if (!sameFederationScope(initial.scope, current.scope)) {
      return respond({ error: "scope_changed" }, 409);
    }
    return respond({
      federationId,
      schools: current.scope.schools,
    }, 200);
  } catch {
    console.error("fanpa_scope_read_failed");
    return respond({ error: "scope_unavailable" }, 503);
  }
}
