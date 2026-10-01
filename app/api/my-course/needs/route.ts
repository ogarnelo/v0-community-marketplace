import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CourseNeedError,
  createCourseNeed,
  listCourseNeeds,
  parseCourseNeedInput,
} from "@/lib/my-course/course-needs-server";

function errorResponse(error: unknown) {
  if (error instanceof CourseNeedError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error("Error en necesidades de Mi curso:", error);
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
    return NextResponse.json({ needs });
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

    return NextResponse.json({ need }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
