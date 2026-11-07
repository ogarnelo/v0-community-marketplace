/**
 * Fail-closed authorization of an educational saved-search alert at the
 * moment an item becomes available. General marketplace searches are not
 * evaluated here: they intentionally remain independent from students.
 */
export type CourseAlertSearch = { user_id: string; demand_request_id: string | null };
export type CourseAlertDemand = { id: string; user_id: string | null; source: string; status: string; school_id: string | null; grade_level: string | null };
export type CourseAlertNeed = { owner_user_id: string; student_id: string; demand_request_id: string | null; status: string; academic_year: string };
export type CourseAlertStudent = { id: string; owner_user_id: string; active: boolean; school_id: string | null; grade_level: string | null; academic_year: string };

export function isCurrentCourseAlert(
  search: CourseAlertSearch,
  demand: CourseAlertDemand | undefined,
  need: CourseAlertNeed | undefined,
  student: CourseAlertStudent | undefined
): boolean {
  if (!search.demand_request_id || !demand || !need || !student) return false;
  return demand.id === search.demand_request_id
    && need.demand_request_id === demand.id
    && demand.source === "course_need"
    && (demand.status === "open" || demand.status === "matched")
    && need.status === "active"
    && student.active
    && search.user_id === demand.user_id
    && search.user_id === need.owner_user_id
    && search.user_id === student.owner_user_id
    && student.id === need.student_id
    && student.academic_year === need.academic_year
    && student.school_id === demand.school_id
    && student.grade_level === demand.grade_level;
}
