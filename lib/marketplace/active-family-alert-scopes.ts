import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

export type CurrentFamilyAlertScope = {
  schoolIds: string[];
  directoryCodes: string[];
};
type Db = ReturnType<typeof createAdminClient>;
type Student = {
  owner_user_id: string;
  school_id: string | null;
  directory_school_code: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIRECTORY_CODE = /^[A-Za-z0-9_-]{1,64}$/;
const PAGE = 50;
const DB_LIMIT = 1000;
const MAX_STUDENTS_PER_USER = 100;

/**
 * Never read school IDs from the request or saved_searches for dynamic alerts.
 * Always resolve current student ownership with a server-only database client,
 * and validate school activity and directory listing status before matching.
 * Missing/revoked memberships yield empty scopes, never a global alert.
 */
export async function loadCurrentFamilyAlertScopes(
  admin: Db,
  userIds: string[],
): Promise<Map<string, CurrentFamilyAlertScope>> {
  const ids = [...new Set(userIds)];
  if (ids.length > 200 || ids.some((id) => !UUID.test(id))) {
    throw new Error("MULTISCHOOL_ALERT_RECIPIENT_LIMIT");
  }
  const result = new Map<string, CurrentFamilyAlertScope>();
  for (const id of ids) result.set(id, { schoolIds: [], directoryCodes: [] });
  if (!ids.length) return result;

  const students: Student[] = [];
  const disallowedUsers = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += PAGE) {
    const page = ids.slice(offset, offset + PAGE);
    const [studentResult, adminResult] = await Promise.all([
      admin.from("account_students")
        .select("owner_user_id,school_id,directory_school_code")
        .in("owner_user_id", page).eq("active", true).limit(DB_LIMIT),
      admin.from("user_roles")
        .select("user_id")
        .in("user_id", page).eq("role", "school_admin").limit(DB_LIMIT),
    ]);
    if (studentResult.error || adminResult.error ||
        !studentResult.data || !adminResult.data ||
        studentResult.data.length >= DB_LIMIT || adminResult.data.length >= DB_LIMIT) {
      throw new Error("MULTISCHOOL_ALERT_MEMBERSHIP_UNAVAILABLE");
    }
    for (const role of adminResult.data) disallowedUsers.add(role.user_id);
    for (const student of studentResult.data) students.push(student);
  }

  const perUser = new Map<string, Student[]>();
  for (const student of students) {
    if (!result.has(student.owner_user_id)) {
      throw new Error("MULTISCHOOL_ALERT_FOREIGN_STUDENT_ROW");
    }
    const bucket = perUser.get(student.owner_user_id) || [];
    bucket.push(student);
    perUser.set(student.owner_user_id, bucket);
    if (bucket.length > MAX_STUDENTS_PER_USER ||
        (student.school_id && student.directory_school_code) ||
        (student.school_id && !UUID.test(student.school_id)) ||
        (student.directory_school_code && !DIRECTORY_CODE.test(student.directory_school_code))) {
      disallowedUsers.add(student.owner_user_id);
    }
  }

  const relevantStudents = students.filter((student) => !disallowedUsers.has(student.owner_user_id));
  const directSchoolIds = [...new Set(relevantStudents
    .map((student) => student.school_id?.toLowerCase()).filter((id): id is string => Boolean(id)))];
  const directCodes = [...new Set(relevantStudents
    .map((student) => student.directory_school_code).filter((code): code is string => Boolean(code)))];

  const listedCodes = new Map<string, string | null>();
  for (let i = 0; i < directCodes.length; i += 150) {
    const { data, error } = await admin.from("school_directory")
      .select("official_code,linked_school_id")
      .in("official_code", directCodes.slice(i, i + 150))
      .eq("is_listed", true).limit(DB_LIMIT);
    if (error || !data || data.length >= DB_LIMIT) {
      throw new Error("MULTISCHOOL_ALERT_DIRECTORY_UNAVAILABLE");
    }
    for (const row of data) listedCodes.set(row.official_code, row.linked_school_id);
  }

  const possibleSchoolIds = [...new Set([
    ...directSchoolIds,
    ...[...listedCodes.values()]
      .filter((id): id is string => typeof id === "string" && UUID.test(id))
      .map((id) => id.toLowerCase()),
  ])];
  const activeSchoolIds = new Set<string>();
  for (let i = 0; i < possibleSchoolIds.length; i += 150) {
    const { data, error } = await admin.from("schools")
      .select("id").in("id", possibleSchoolIds.slice(i, i + 150))
      .eq("is_active", true).limit(DB_LIMIT);
    if (error || !data || data.length >= DB_LIMIT) {
      throw new Error("MULTISCHOOL_ALERT_SCHOOLS_UNAVAILABLE");
    }
    for (const school of data) activeSchoolIds.add(school.id.toLowerCase());
  }

  const directoryCodesForSchool = new Map<string, Set<string>>();
  const activeIdList = [...activeSchoolIds];
  for (let i = 0; i < activeIdList.length; i += 150) {
    const { data, error } = await admin.from("school_directory")
      .select("official_code,linked_school_id")
      .in("linked_school_id", activeIdList.slice(i, i + 150))
      .eq("is_listed", true).limit(DB_LIMIT);
    if (error || !data || data.length >= DB_LIMIT) {
      throw new Error("MULTISCHOOL_ALERT_DIRECTORY_LINKS_UNAVAILABLE");
    }
    for (const row of data) {
      if (!row.linked_school_id || !activeSchoolIds.has(row.linked_school_id.toLowerCase()) ||
          !DIRECTORY_CODE.test(row.official_code)) continue;
      const key = row.linked_school_id.toLowerCase();
      const values = directoryCodesForSchool.get(key) || new Set<string>();
      values.add(row.official_code);
      directoryCodesForSchool.set(key, values);
    }
  }

  for (const id of ids) {
    if (disallowedUsers.has(id)) continue;
    const schoolIds = new Set<string>();
    const directoryCodes = new Set<string>();
    for (const student of perUser.get(id) || []) {
      const direct = student.school_id?.toLowerCase() || null;
      const code = student.directory_school_code || null;
      if (direct && activeSchoolIds.has(direct)) {
        schoolIds.add(direct);
        for (const linkedCode of directoryCodesForSchool.get(direct) || []) {
          directoryCodes.add(linkedCode);
        }
      } else if (code && listedCodes.has(code)) {
        const linkedId = listedCodes.get(code)?.toLowerCase() || null;
        // A directory-only school may be listed without an operational link.
        // An existing but inactive/malformed link MUST NOT authorize alerts.
        if (linkedId && !activeSchoolIds.has(linkedId)) continue;
        directoryCodes.add(code);
        if (linkedId) {
          schoolIds.add(linkedId);
          for (const linkedCode of directoryCodesForSchool.get(linkedId) || []) {
            directoryCodes.add(linkedCode);
          }
        }
      }
    }
    result.set(id, { schoolIds: [...schoolIds].sort(), directoryCodes: [...directoryCodes].sort() });
  }
  return result;
}
