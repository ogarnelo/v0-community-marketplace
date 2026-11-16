import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
import { createClient } from "@/lib/supabase/server";
import { CourseNeedError } from "@/lib/my-course/course-needs-server";
import { archiveCourseNeedAndStopSearch } from "@/lib/my-course/course-need-search-server";

function errorResponse(error: unknown) {
  if (error instanceof CourseNeedError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: PRIVATE_HEADERS }
    );
  }

  console.error("Error actualizando una necesidad de Mi curso:", error);
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

  return user;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const need = await archiveCourseNeedAndStopSearch(user.id, id);
    return NextResponse.json({ need }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}
