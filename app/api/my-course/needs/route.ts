import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
import { createClient } from "@/lib/supabase/server";
import {
  CourseNeedError,
  createCourseNeed,
  listCourseNeeds,
  parseCourseNeedInput,
} from "@/lib/my-course/course-needs-server";
import { deferProductEvent } from "@/lib/analytics/product-events.server";

function errorResponse(error: unknown) {
  if (error instanceof CourseNeedError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: PRIVATE_HEADERS }
    );
  }

  console.error("Error en necesidades de Mi curso:", error);
  return NextResponse.json(
    { error: "No se pudo completar la operación." },
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
    const missingSession = authError.name === "AuthSessionMissingError" ||
      authError.code === "session_not_found";
    if (missingSession) throw new CourseNeedError("Debes iniciar sesión.", 401, "unauthorized");
    throw new CourseNeedError("No se pudo comprobar tu sesión.", 503, "auth_unavailable");
  }
  const user = data?.user ?? null;

  if (!user) {
    throw new CourseNeedError("Debes iniciar sesión.", 401, "unauthorized");
  }

  if (!user.email_confirmed_at) {
    throw new CourseNeedError(
      "Confirma tu email antes de usar Mi curso.",
      403,
      "email_not_confirmed"
    );
  }

  return user;
}

export async function GET() {
  try {
    const user = await requireUser();
    const needs = await listCourseNeeds(user.id);
    return NextResponse.json({ needs }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const input = parseCourseNeedInput(body);
    const need = await createCourseNeed(user.id, input);

    deferProductEvent("course_need_created", { source: "mi_curso" });

    return NextResponse.json({ need }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}
