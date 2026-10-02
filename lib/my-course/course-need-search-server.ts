import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  archiveCourseNeed,
  CourseNeedError,
  type CourseNeedRow,
} from "@/lib/my-course/course-needs-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CourseNeedContext = CourseNeedRow & {
  student: {
    id: string;
    school_id: string | null;
    grade_level: string;
    academic_year: string;
  };
};

function demandTitle(need: CourseNeedRow) {
  const title = need.title.trim();
  if (title.length >= 2) return title.slice(0, 160);
  return `${title} · ${need.category}`.slice(0, 160);
}

function normalizedDemandQuery(need: CourseNeedRow) {
  const value = need.title.trim().toLowerCase();
  return value ? value.slice(0, 160) : null;
}

async function bestEffort(query: PromiseLike<unknown>) {
  try {
    await query;
  } catch {
    // Best-effort compensation must never hide the original failure.
  }
}

export async function getCourseNeedSearchStates(
  userId: string,
  demandRequestIds: Array<string | null>
) {
  const ids = Array.from(
    new Set(demandRequestIds.filter((id): id is string => Boolean(id)))
  );
  if (ids.length === 0) return {} as Record<string, boolean>;

  const admin = createAdminClient();
  const [demandResult, searchResult] = await Promise.all([
    admin
      .from("demand_requests")
      .select("id, status")
      .eq("user_id", userId)
      .eq("source", "course_need")
      .in("id", ids),
    admin
      .from("saved_searches")
      .select("demand_request_id, notifications_enabled")
      .eq("user_id", userId)
      .eq("intent_source", "course_need")
      .in("demand_request_id", ids),
  ]);

  if (demandResult.error) throw demandResult.error;
  if (searchResult.error) throw searchResult.error;

  const enabledDemandIds = new Set(
    (searchResult.data || [])
      .filter((search) => search.notifications_enabled && search.demand_request_id)
      .map((search) => search.demand_request_id as string)
  );

  const states: Record<string, boolean> = {};
  for (const demand of demandResult.data || []) {
    states[demand.id] =
      enabledDemandIds.has(demand.id) &&
      (demand.status === "open" || demand.status === "matched");
  }

  return states;
}

async function loadOwnedActiveNeedRow(userId: string, needId: string) {
  if (!UUID_RE.test(needId)) {
    throw new CourseNeedError("La necesidad no es válida.", 400, "invalid_need");
  }

  const admin = createAdminClient();
  const { data: need, error } = await admin
    .from("course_needs")
    .select(
      "id, owner_user_id, student_id, title, isbn, category, academic_year, demand_request_id, status, created_at, updated_at"
    )
    .eq("id", needId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!need || need.status !== "active") {
    throw new CourseNeedError(
      "Esa necesidad ya no está disponible.",
      404,
      "need_not_found"
    );
  }

  return need as CourseNeedRow;
}

async function loadOwnedActiveNeed(userId: string, needId: string): Promise<CourseNeedContext> {
  const admin = createAdminClient();
  const need = await loadOwnedActiveNeedRow(userId, needId);

  const { data: student, error: studentError } = await admin
    .from("account_students")
    .select("id, owner_user_id, active, school_id, grade_level, academic_year")
    .eq("id", need.student_id)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (studentError) throw studentError;
  if (
    !student ||
    !student.active ||
    student.academic_year !== need.academic_year
  ) {
    throw new CourseNeedError(
      "El contexto educativo de esta necesidad ya no está activo.",
      409,
      "student_context_changed"
    );
  }

  return {
    ...(need as CourseNeedRow),
    student: {
      id: student.id,
      school_id: student.school_id,
      grade_level: student.grade_level,
      academic_year: student.academic_year,
    },
  };
}

async function findExistingDemand(userId: string, needId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("demand_requests")
    .select("id, status")
    .eq("user_id", userId)
    .eq("source", "course_need")
    .contains("metadata", { course_need_id: needId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function ensureDemandActive(userId: string, demandRequestId: string) {
  const admin = createAdminClient();
  const { data: demand, error } = await admin
    .from("demand_requests")
    .select("id, status")
    .eq("id", demandRequestId)
    .eq("user_id", userId)
    .eq("source", "course_need")
    .maybeSingle();

  if (error) throw error;
  if (!demand) {
    throw new CourseNeedError(
      "La búsqueda asociada ya no está disponible.",
      409,
      "search_not_found"
    );
  }

  if (demand.status === "closed") {
    throw new CourseNeedError(
      "Esta búsqueda ya está cerrada.",
      409,
      "search_closed"
    );
  }

  if (demand.status !== "dismissed") {
    return { reopened: false };
  }

  const { error: reopenError } = await admin
    .from("demand_requests")
    .update({ status: "open" })
    .eq("id", demandRequestId)
    .eq("user_id", userId)
    .eq("source", "course_need")
    .eq("status", "dismissed");

  if (reopenError) throw reopenError;
  return { reopened: true };
}

async function ensureSavedSearch(
  userId: string,
  need: CourseNeedContext,
  demandRequestId: string
) {
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("saved_searches")
    .select("id, notifications_enabled")
    .eq("user_id", userId)
    .eq("demand_request_id", demandRequestId)
    .eq("intent_source", "course_need")
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    if (!existing.notifications_enabled) {
      const { error: enableError } = await admin
        .from("saved_searches")
        .update({
          notifications_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("user_id", userId)
        .eq("intent_source", "course_need");

      if (enableError) throw enableError;
      return { id: existing.id, created: false, reenabled: true };
    }

    return { id: existing.id, created: false, reenabled: false };
  }

  const { data, error } = await admin
    .from("saved_searches")
    .insert({
      user_id: userId,
      name: demandTitle(need),
      query: need.isbn ? null : need.title,
      isbn_query: need.isbn,
      category: null,
      grade_level: null,
      listing_type: null,
      condition: null,
      only_my_community: false,
      school_id: need.student.school_id,
      results_count: 0,
      source_path: "/mi-curso",
      need_details: need.title,
      intent_source: "course_need",
      notifications_enabled: true,
      demand_request_id: demandRequestId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id, created: true, reenabled: false };
}

async function loadNeedRow(userId: string, needId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("course_needs")
    .select(
      "id, owner_user_id, student_id, title, isbn, category, academic_year, demand_request_id, status, created_at, updated_at"
    )
    .eq("id", needId)
    .eq("owner_user_id", userId)
    .single();

  if (error) throw error;
  return data as CourseNeedRow;
}

export async function activateCourseNeedSearch(userId: string, needId: string) {
  const admin = createAdminClient();
  const need = await loadOwnedActiveNeed(userId, needId);

  if (need.demand_request_id) {
    let reopened = false;
    let reenabledSavedSearchId: string | null = null;

    try {
      const demandState = await ensureDemandActive(userId, need.demand_request_id);
      reopened = demandState.reopened;

      const savedSearch = await ensureSavedSearch(
        userId,
        need,
        need.demand_request_id
      );
      if (savedSearch.reenabled) reenabledSavedSearchId = savedSearch.id;

      return loadNeedRow(userId, need.id);
    } catch (error) {
      if (reenabledSavedSearchId) {
        await bestEffort(
          admin
            .from("saved_searches")
            .update({
              notifications_enabled: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", reenabledSavedSearchId)
            .eq("user_id", userId)
            .eq("intent_source", "course_need")
        );
      }

      if (reopened) {
        await bestEffort(
          admin
            .from("demand_requests")
            .update({ status: "dismissed" })
            .eq("id", need.demand_request_id)
            .eq("user_id", userId)
            .eq("source", "course_need")
            .eq("status", "open")
        );
      }

      throw error;
    }
  }

  let createdDemandId: string | null = null;
  let createdSavedSearchId: string | null = null;
  let reenabledSavedSearchId: string | null = null;
  let reopenedDemandId: string | null = null;

  async function compensateActivation() {
    if (createdSavedSearchId) {
      await bestEffort(
        admin
          .from("saved_searches")
          .delete()
          .eq("id", createdSavedSearchId)
          .eq("user_id", userId)
          .eq("intent_source", "course_need")
      );
    } else if (reenabledSavedSearchId) {
      await bestEffort(
        admin
          .from("saved_searches")
          .update({
            notifications_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reenabledSavedSearchId)
          .eq("user_id", userId)
          .eq("intent_source", "course_need")
      );
    }

    if (createdDemandId) {
      await bestEffort(
        admin
          .from("demand_requests")
          .delete()
          .eq("id", createdDemandId)
          .eq("user_id", userId)
          .eq("source", "course_need")
      );
    } else if (reopenedDemandId) {
      await bestEffort(
        admin
          .from("demand_requests")
          .update({ status: "dismissed" })
          .eq("id", reopenedDemandId)
          .eq("user_id", userId)
          .eq("source", "course_need")
          .eq("status", "open")
      );
    }
  }

  try {
    let demand = await findExistingDemand(userId, need.id);

    if (!demand) {
      const { data, error } = await admin
        .from("demand_requests")
        .insert({
          user_id: userId,
          title: demandTitle(need),
          normalized_query: normalizedDemandQuery(need),
          category: need.category,
          grade_level: need.student.grade_level,
          isbn: need.isbn,
          school_id: need.student.school_id,
          status: "open",
          source: "course_need",
          metadata: {
            course_need_id: need.id,
            student_id: need.student_id,
            academic_year: need.academic_year,
          },
        })
        .select("id, status")
        .single();

      if (error) throw error;
      demand = data;
      createdDemandId = data.id;
    } else {
      const demandState = await ensureDemandActive(userId, demand.id);
      if (demandState.reopened) reopenedDemandId = demand.id;
    }

    const savedSearch = await ensureSavedSearch(userId, need, demand.id);
    if (savedSearch.created) createdSavedSearchId = savedSearch.id;
    if (savedSearch.reenabled) reenabledSavedSearchId = savedSearch.id;

    const { data: linked, error: linkError } = await admin
      .from("course_needs")
      .update({
        demand_request_id: demand.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", need.id)
      .eq("owner_user_id", userId)
      .eq("status", "active")
      .is("demand_request_id", null)
      .select(
        "id, owner_user_id, student_id, title, isbn, category, academic_year, demand_request_id, status, created_at, updated_at"
      )
      .maybeSingle();

    if (linkError) throw linkError;
    if (linked) return linked as CourseNeedRow;

    const current = await loadNeedRow(userId, need.id);
    if (current.demand_request_id) {
      if (current.demand_request_id !== demand.id) {
        await compensateActivation();
      }
      return current;
    }

    throw new CourseNeedError(
      "No se pudo vincular Buscar por mí a esta necesidad.",
      409,
      "search_link_failed"
    );
  } catch (error) {
    await compensateActivation();
    throw error;
  }
}

export async function pauseCourseNeedSearch(userId: string, needId: string) {
  const admin = createAdminClient();
  const need = await loadOwnedActiveNeedRow(userId, needId);

  if (!need.demand_request_id) {
    return loadNeedRow(userId, need.id);
  }

  const demandRequestId = need.demand_request_id;
  const { data: demand, error: demandError } = await admin
    .from("demand_requests")
    .select("id, status")
    .eq("id", demandRequestId)
    .eq("user_id", userId)
    .eq("source", "course_need")
    .maybeSingle();

  if (demandError) throw demandError;
  if (!demand) {
    throw new CourseNeedError(
      "La búsqueda asociada ya no está disponible.",
      409,
      "search_not_found"
    );
  }

  const { data: searches, error: searchesError } = await admin
    .from("saved_searches")
    .select("id, notifications_enabled")
    .eq("user_id", userId)
    .eq("demand_request_id", demandRequestId)
    .eq("intent_source", "course_need");

  if (searchesError) throw searchesError;

  const enabledSearchIds = (searches || [])
    .filter((search) => search.notifications_enabled)
    .map((search) => search.id);

  if (enabledSearchIds.length > 0) {
    const { error: pauseError } = await admin
      .from("saved_searches")
      .update({
        notifications_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .in("id", enabledSearchIds)
      .eq("user_id", userId)
      .eq("intent_source", "course_need");

    if (pauseError) throw pauseError;
  }

  if (demand.status === "open" || demand.status === "matched") {
    const { error: dismissError } = await admin
      .from("demand_requests")
      .update({ status: "dismissed" })
      .eq("id", demandRequestId)
      .eq("user_id", userId)
      .eq("source", "course_need")
      .in("status", ["open", "matched"]);

    if (dismissError) {
      if (enabledSearchIds.length > 0) {
        await bestEffort(
          admin
            .from("saved_searches")
            .update({
              notifications_enabled: true,
              updated_at: new Date().toISOString(),
            })
            .in("id", enabledSearchIds)
            .eq("user_id", userId)
            .eq("intent_source", "course_need")
        );
      }
      throw dismissError;
    }
  }

  return loadNeedRow(userId, need.id);
}

export async function archiveCourseNeedAndStopSearch(userId: string, needId: string) {
  const admin = createAdminClient();
  const need = await loadOwnedActiveNeedRow(userId, needId);

  if (!need.demand_request_id) {
    return archiveCourseNeed(userId, needId);
  }

  const demandRequestId = need.demand_request_id;
  const { data: demand, error: demandError } = await admin
    .from("demand_requests")
    .select("id, status")
    .eq("id", demandRequestId)
    .eq("user_id", userId)
    .eq("source", "course_need")
    .maybeSingle();

  if (demandError) throw demandError;

  const { data: searches, error: searchesError } = await admin
    .from("saved_searches")
    .select("id, notifications_enabled")
    .eq("user_id", userId)
    .eq("demand_request_id", demandRequestId)
    .eq("intent_source", "course_need");

  if (searchesError) throw searchesError;

  const enabledSearchIds = (searches || [])
    .filter((search) => search.notifications_enabled)
    .map((search) => search.id);

  if (enabledSearchIds.length > 0) {
    const { error } = await admin
      .from("saved_searches")
      .update({
        notifications_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .in("id", enabledSearchIds)
      .eq("user_id", userId);
    if (error) throw error;
  }

  const previousDemandStatus = demand?.status || null;
  let demandStatusChanged = false;

  if (demand && (demand.status === "open" || demand.status === "matched")) {
    const { error } = await admin
      .from("demand_requests")
      .update({ status: "dismissed" })
      .eq("id", demandRequestId)
      .eq("user_id", userId)
      .in("status", ["open", "matched"]);
    if (error) {
      if (enabledSearchIds.length > 0) {
        await bestEffort(
          admin
            .from("saved_searches")
            .update({
              notifications_enabled: true,
              updated_at: new Date().toISOString(),
            })
            .in("id", enabledSearchIds)
            .eq("user_id", userId)
        );
      }
      throw error;
    }
    demandStatusChanged = true;
  }

  try {
    return await archiveCourseNeed(userId, needId);
  } catch (error) {
    if (demandStatusChanged && previousDemandStatus) {
      await bestEffort(
        admin
          .from("demand_requests")
          .update({ status: previousDemandStatus })
          .eq("id", demandRequestId)
          .eq("user_id", userId)
      );
    }

    if (enabledSearchIds.length > 0) {
      await bestEffort(
        admin
          .from("saved_searches")
          .update({
            notifications_enabled: true,
            updated_at: new Date().toISOString(),
          })
          .in("id", enabledSearchIds)
          .eq("user_id", userId)
      );
    }

    throw error;
  }
}
