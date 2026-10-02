import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  archiveCourseNeed,
  CourseNeedError,
  createCourseNeed,
  type CourseNeedRow,
} from "@/lib/my-course/course-needs-server";
import { activateCourseNeedSearch } from "@/lib/my-course/course-need-search-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FulfilledSource = {
  id: string;
  owner_user_id: string;
  student_id: string;
  title: string;
  isbn: string | null;
  category: string;
  academic_year: string;
  demand_request_id: string | null;
  status: "fulfilled";
};

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIsbn(value: string | null | undefined) {
  return (value || "").replace(/[^0-9xX]/g, "").toUpperCase();
}

async function bestEffort(task: PromiseLike<unknown>) {
  try {
    await task;
  } catch {
    // Cleanup must not hide the original failure.
  }
}

async function loadOwnedFulfilledNeed(
  userId: string,
  needId: string
): Promise<FulfilledSource> {
  if (!UUID_RE.test(needId)) {
    throw new CourseNeedError("La necesidad no es válida.", 400, "invalid_need");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("course_needs")
    .select(
      "id, owner_user_id, student_id, title, isbn, category, academic_year, demand_request_id, status"
    )
    .eq("id", needId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.status !== "fulfilled") {
    throw new CourseNeedError(
      "Esa necesidad no está disponible en Conseguidos.",
      404,
      "fulfilled_need_not_found"
    );
  }

  return data as FulfilledSource;
}

async function findEquivalentActiveNeed(
  userId: string,
  source: FulfilledSource
): Promise<CourseNeedRow | null> {
  const admin = createAdminClient();
  const { data: student, error: studentError } = await admin
    .from("account_students")
    .select("id, active, academic_year")
    .eq("id", source.student_id)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (studentError) throw studentError;
  if (!student || !student.active) {
    throw new CourseNeedError(
      "Ese estudiante ya no está disponible en tu cuenta.",
      404,
      "student_not_found"
    );
  }

  const { data: rows, error } = await admin
    .from("course_needs")
    .select(
      "id, owner_user_id, student_id, title, isbn, category, academic_year, demand_request_id, status, created_at, updated_at"
    )
    .eq("owner_user_id", userId)
    .eq("student_id", source.student_id)
    .eq("academic_year", student.academic_year)
    .eq("status", "active")
    .limit(200);

  if (error) throw error;

  const sourceIsbn = normalizeIsbn(source.isbn);
  const sourceTitle = normalizeText(source.title);
  const sourceCategory = normalizeText(source.category);

  const match = (rows || []).find((row: any) => {
    if (sourceIsbn && row.isbn) {
      return normalizeIsbn(row.isbn) === sourceIsbn;
    }

    return (
      !sourceIsbn &&
      !row.isbn &&
      normalizeText(row.title) === sourceTitle &&
      normalizeText(row.category) === sourceCategory
    );
  });

  return (match || null) as CourseNeedRow | null;
}

export async function restartFulfilledCourseNeed(
  userId: string,
  fulfilledNeedId: string
) {
  const source = await loadOwnedFulfilledNeed(userId, fulfilledNeedId);

  let activeNeed: CourseNeedRow;
  let created = false;

  try {
    activeNeed = await createCourseNeed(userId, {
      studentId: source.student_id,
      title: source.title,
      isbn: source.isbn,
      category: source.category,
    });
    created = true;
  } catch (error) {
    if (!(error instanceof CourseNeedError) || error.code !== "need_exists") {
      throw error;
    }

    const existing = await findEquivalentActiveNeed(userId, source);
    if (!existing) throw error;
    activeNeed = existing;
  }

  try {
    const activated = await activateCourseNeedSearch(userId, activeNeed.id);
    return {
      need: activated,
      restarted_from_id: source.id,
      previous_demand_request_id: source.demand_request_id,
      reused_existing: !created,
    };
  } catch (error) {
    if (created) {
      await bestEffort(archiveCourseNeed(userId, activeNeed.id));
    }
    throw error;
  }
}
