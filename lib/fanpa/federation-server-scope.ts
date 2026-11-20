import { createAdminClient } from "@/lib/supabase/admin";
import { resolveFederationRepresentation } from "@/lib/fanpa/federation-representation";

export const FANPA_MAX_LINKS = 100;
export const FANPA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Admin = ReturnType<typeof createAdminClient>;
export type AuthorizedFederationScope = {
  federationId: string;
  schoolIds: string[];
  schools: { id: string; name: string }[];
};
export type ScopeReadResult =
  | { ok: true; scope: AuthorizedFederationScope }
  | { ok: false; status: 403 | 503; error: "scope_forbidden" | "scope_unavailable" };

/**
 * Read the entire scope from trusted server tables on each authorization pass.
 * Neither the federation ID nor a selected school ID proves authorization.
 * Do not reuse this return value across requests or cache the result.
 */
export async function readAuthorizedFederationScope(
  admin: Admin,
  federationId: string,
  userId: string,
): Promise<ScopeReadResult> {
  const [federations, members, links] = await Promise.all([
    admin.from("fanpa_federations").select("id,is_active,is_test")
      .eq("id", federationId).limit(2),
    admin.from("fanpa_administrators").select("federation_id,user_id,active")
      .eq("federation_id", federationId).eq("user_id", userId).limit(2),
    admin.from("fanpa_represented_schools").select("federation_id,school_id,active")
      .eq("federation_id", federationId).limit(FANPA_MAX_LINKS + 1),
  ]);
  if (federations.error || members.error || links.error ||
      !Array.isArray(federations.data) || !Array.isArray(members.data) ||
      !Array.isArray(links.data) || links.data.length > FANPA_MAX_LINKS) {
    return { ok: false, status: 503, error: "scope_unavailable" };
  }
  if (federations.data.length !== 1 || federations.data[0].is_active !== true ||
      federations.data[0].is_test === true ||
      members.data.length !== 1 || members.data[0].active !== true) {
    return { ok: false, status: 403, error: "scope_forbidden" };
  }
  const activeIds = [...new Set(links.data.filter(link => link.active === true)
    .map(link => link.school_id))];
  if (activeIds.length === 0 || activeIds.length > FANPA_MAX_LINKS) {
    return { ok: false, status: 403, error: "scope_forbidden" };
  }
  const schools = await admin.from("schools").select("id,name,is_active,is_test")
    .in("id", activeIds).limit(FANPA_MAX_LINKS + 1);
  if (schools.error || !Array.isArray(schools.data) ||
      schools.data.length > FANPA_MAX_LINKS) {
    return { ok: false, status: 503, error: "scope_unavailable" };
  }
  const decision = resolveFederationRepresentation({
    authenticatedUserId: userId,
    requestedFederationId: federationId,
    federations: federations.data,
    administratorLinks: members.data,
    schoolLinks: links.data,
    schools: schools.data,
  });
  if (!decision.authorized) {
    return { ok: false, status: 403, error: "scope_forbidden" };
  }
  const byId = new Map(schools.data.map(school => [school.id, school]));
  return {
    ok: true,
    scope: {
      federationId,
      schoolIds: decision.representedSchoolIds,
      schools: decision.representedSchoolIds.map(id => ({
        id,
        name: byId.get(id)?.name ?? "",
      })),
    },
  };
}

export function sameFederationScope(
  before: AuthorizedFederationScope,
  after: AuthorizedFederationScope,
): boolean {
  return before.federationId === after.federationId &&
    before.schoolIds.length === after.schoolIds.length &&
    before.schoolIds.every((id, i) => id === after.schoolIds[i]) &&
    before.schools.every((school, i) =>
      school.id === after.schools[i]?.id && school.name === after.schools[i]?.name);
}
