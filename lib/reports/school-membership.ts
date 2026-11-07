/**
 * Canonical school membership, shared by AMPA dashboards and official reports.
 * A user belongs to each school associated with an active educational context.
 * Legacy profile.school_id is used only for accounts without active contexts.
 * Administrators are counted as linked accounts for their own school.
 */
export function getSchoolMemberIds(params: {
  schoolId: string;
  profiles: Array<{ id: string; school_id: string | null }>;
  activeStudents: Array<{ owner_user_id: string; school_id: string | null }>;
  schoolAdmins: Array<{ user_id: string }>;
}): Set<string> {
  const { schoolId, profiles, activeStudents, schoolAdmins } = params;
  const ownersWithActiveContext = new Set(activeStudents.map((student) => student.owner_user_id));
  const linked = new Set(
    activeStudents
      .filter((student) => student.school_id === schoolId)
      .map((student) => student.owner_user_id)
  );
  for (const role of schoolAdmins) linked.add(role.user_id);
  for (const profile of profiles) {
    if (profile.school_id === schoolId && !ownersWithActiveContext.has(profile.id)) {
      linked.add(profile.id);
    }
  }
  return linked;
}

export function countSchoolStudents(
  schoolId: string,
  activeStudents: Array<{ owner_user_id: string; school_id: string | null }>
): number {
  return activeStudents.filter((student) => student.school_id === schoolId).length;
}
