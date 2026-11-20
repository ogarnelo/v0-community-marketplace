/**
 * Pure, fail-closed federation authorization. The CALLER must obtain the input
 * using trusted server-side reads; never accept role/link rows from the browser.
 * This module deliberately performs no IO and grants no database privileges.
 */
type Federation = { id: string; is_active: boolean; is_test: boolean };
type FederationAdminLink = { federation_id: string; user_id: string; active: boolean };
type FederationSchoolLink = { federation_id: string; school_id: string; active: boolean };
type School = { id: string; is_active: boolean; is_test: boolean };

export type FederationScopeDecision =
  | { authorized: false; reason: "identity_unavailable" | "federation_unavailable" | "membership_unavailable" | "school_scope_unavailable" }
  | { authorized: true; federationId: string; representedSchoolIds: string[] };

export function resolveFederationRepresentation(input: {
  authenticatedUserId: string | null | undefined;
  requestedFederationId: string | null | undefined;
  federations: readonly Federation[] | null | undefined;
  administratorLinks: readonly FederationAdminLink[] | null | undefined;
  schoolLinks: readonly FederationSchoolLink[] | null | undefined;
  schools: readonly School[] | null | undefined;
}): FederationScopeDecision {
  const { authenticatedUserId: actor, requestedFederationId: federationId } = input;
  if (!actor || !federationId) return { authorized: false, reason: "identity_unavailable" };
  // Any failed or partial provider read must be converted to null by the
  // caller. Do not interpret missing data as an empty, authorized scope.
  if (!Array.isArray(input.federations) || !Array.isArray(input.administratorLinks) ||
      !Array.isArray(input.schoolLinks) || !Array.isArray(input.schools)) {
    return { authorized: false, reason: "federation_unavailable" };
  }
  const matchingFederations = input.federations.filter(f => f.id === federationId);
  if (matchingFederations.length !== 1 || matchingFederations[0].is_active !== true ||
      matchingFederations[0].is_test === true) {
    return { authorized: false, reason: "federation_unavailable" };
  }
  const memberLinks = input.administratorLinks.filter(
    link => link.federation_id === federationId && link.user_id === actor
  );
  // No implicit super_admin / school_admin override, and no reliance on
  // user-editable JWT claims. Duplicate grants are treated as ambiguous.
  if (memberLinks.length !== 1 || memberLinks[0].active !== true) {
    return { authorized: false, reason: "membership_unavailable" };
  }
  const byId = new Map(input.schools.map(school => [school.id, school]));
  const ids = new Set<string>();
  for (const link of input.schoolLinks) {
    if (link.federation_id !== federationId || link.active !== true) continue;
    const school = byId.get(link.school_id);
    // Fail closed if even one active representation points to a missing,
    // inactive or synthetic school; do not publish partial KPI totals.
    if (!school || school.is_active !== true || school.is_test === true) {
      return { authorized: false, reason: "school_scope_unavailable" };
    }
    ids.add(school.id);
  }
  if (ids.size === 0) return { authorized: false, reason: "school_scope_unavailable" };
  return { authorized: true, federationId, representedSchoolIds: [...ids].sort() };
}
