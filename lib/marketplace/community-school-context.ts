/** Current authorized school scope for "Solo mi comunidad".
 * Never trust a caller-supplied list of school IDs for saved-search alerts.
 * An administrator's school assignment takes precedence; families use the
 * schools of ALL active students; legacy profile school is a fallback only
 * when there are no active student contexts.
 */
export type CommunitySchoolStudent = { owner_user_id: string; school_id: string | null };
export type CommunitySchoolRole = { user_id: string; school_id: string | null; role: string };
export type CommunitySchoolProfile = { id: string; school_id: string | null };

export function resolveCommunitySchoolsForUsers(params: {
  userIds: string[];
  profiles: CommunitySchoolProfile[];
  students: CommunitySchoolStudent[];
  roles: CommunitySchoolRole[];
}): Map<string, string[]> {
  const { userIds, profiles, students, roles } = params;
  const schoolByUser = new Map<string, string[]>();
  for (const userId of new Set(userIds)) {
    const adminSchools = roles
      .filter((role) => role.user_id === userId && role.role === "school_admin" && role.school_id)
      .map((role) => role.school_id as string);
    const userStudents = students.filter((student) => student.owner_user_id === userId);
    const studentSchools = userStudents.map((student) => student.school_id).filter((id): id is string => Boolean(id));
    const profile = profiles.find((entry) => entry.id === userId);
    const legacySchools = userStudents.length === 0 && profile?.school_id ? [profile.school_id] : [];
    schoolByUser.set(userId, Array.from(new Set(
      adminSchools.length > 0 ? adminSchools : userStudents.length > 0 ? studentSchools : legacySchools
    )));
  }
  return schoolByUser;
}
