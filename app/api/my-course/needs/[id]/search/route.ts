import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CourseNeedError } from "@/lib/my-course/course-needs-server";
import {
  activateCourseNeedSearch,
  pauseCourseNeedSearch,
} from "@/lib/my-course/course-need-search-server";

function errorResponse(error: unknown) {
  if (error instanceof CourseNeedError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error("Error actualizando Buscar por mí:", error);
  return NextResponse.json(
    { error: "No se pudo actualizar Buscar por mí." },
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
      "Confirma tu email antes de usar Buscar por mí.",
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
    const need = await activateCourseNeedSearch(user.id, id);
    return NextResponse.json({
      need: { ...need, search_active: true },
    });
  } catch (error) {
    return errorResponse(error);
  }
}


export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const need = await pauseCourseNeedSearch(user.id, id);
    return NextResponse.json({
      need: { ...need, search_active: false },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
