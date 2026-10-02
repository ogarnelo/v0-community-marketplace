import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CourseNeedError } from "@/lib/my-course/course-needs-server";
import { restartFulfilledCourseNeed } from "@/lib/my-course/course-need-restart-server";

function errorResponse(error: unknown) {
  if (error instanceof CourseNeedError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error("Error reiniciando una necesidad de Mi curso:", error);
  return NextResponse.json(
    { error: "No se pudo volver a buscar este material." },
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

  if (!user.email_confirmed_at) {
    throw new CourseNeedError(
      "Confirma tu email antes de volver a buscar.",
      403,
      "email_not_confirmed"
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
    });
  } catch (error) {
    return errorResponse(error);
  }
}
