import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CourseNeedError } from "@/lib/my-course/course-needs-server";
import { archiveCourseNeedAndStopSearch } from "@/lib/my-course/course-need-search-server";

function errorResponse(error: unknown) {
  if (error instanceof CourseNeedError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error("Error actualizando una necesidad de Mi curso:", error);
  return NextResponse.json(
    { error: "No se pudo completar la operación." },
    { status: 500 }
  );
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    return NextResponse.json({ need });
  } catch (error) {
    return errorResponse(error);
  }
}
