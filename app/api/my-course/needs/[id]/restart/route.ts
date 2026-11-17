import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CourseNeedError } from "@/lib/my-course/course-needs-server";
import { restartFulfilledCourseNeed } from "@/lib/my-course/course-need-restart-server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

function errorResponse(error: unknown) {
  if (error instanceof CourseNeedError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: PRIVATE_HEADERS }
    );
  }
  console.error("course_need_restart_failed");
  return NextResponse.json(
    { error: "No se pudo volver a buscar este material." },
    { status: 500, headers: PRIVATE_HEADERS }
  );
}

async function requireUser() {
  let auth;
  try {
    const supabase = await createClient();
    auth = await supabase.auth.getUser();
  } catch {
    throw new CourseNeedError("No se pudo comprobar tu sesión.", 503, "auth_unavailable");
  }
  const { data, error: authError } = auth;
  if (authError) {
    const noSession = authError.name === "AuthSessionMissingError" ||
      authError.code === "session_not_found";
    if (noSession) throw new CourseNeedError("Debes iniciar sesión.", 401, "unauthorized");
    throw new CourseNeedError("No se pudo comprobar tu sesión.", 503, "auth_unavailable");
  }
  const user = data?.user ?? null;
  if (!user) throw new CourseNeedError("Debes iniciar sesión.", 401, "unauthorized");
  if (!user.email_confirmed_at) {
    throw new CourseNeedError(
      "Confirma tu email antes de volver a buscar.",
      403, "email_not_confirmed"
    );
  }
  return user;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await restartFulfilledCourseNeed(user.id, id);
    return NextResponse.json({
      need: { ...result.need, search_active: true },
      restarted_from_id: result.restarted_from_id,
      previous_demand_request_id: result.previous_demand_request_id,
      reused_existing: result.reused_existing,
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}
