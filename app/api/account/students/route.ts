import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
import { createClient } from "@/lib/supabase/server";
import {
  AccountStudentError,
  createAccountStudent,
  listAccountStudents,
  parseStudentInput,
} from "@/lib/account-students/server";
import { deferProductEvent } from "@/lib/analytics/product-events.server";

function errorResponse(error: unknown) {
  if (error instanceof AccountStudentError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: PRIVATE_HEADERS }
    );
  }

  console.error("Error en estudiantes de cuenta:", error);
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
    throw new AccountStudentError("No se pudo comprobar tu sesión.", 503, "auth_unavailable");
  }
  const { data, error: authError } = auth;
  if (authError) {
    const missingSession = authError.name === "AuthSessionMissingError" ||
      authError.code === "session_not_found";
    if (missingSession) throw new AccountStudentError("Debes iniciar sesión.", 401, "unauthorized");
    throw new AccountStudentError("No se pudo comprobar tu sesión.", 503, "auth_unavailable");
  }
  const user = data?.user ?? null;

  if (!user) {
    throw new AccountStudentError("Debes iniciar sesión.", 401, "unauthorized");
  }

  if (!user.email_confirmed_at) {
    throw new AccountStudentError(
      "Confirma tu email antes de configurar estudiantes.",
      403,
      "email_not_confirmed"
    );
  }

  return user;
}

export async function GET() {
  try {
    const user = await requireUser();
    const students = await listAccountStudents(user.id);
    return NextResponse.json({ students }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const input = parseStudentInput(body);
    const student = await createAccountStudent(user.id, input);

    // Directory-only references do not signify membership in an active community.
    if (input.schoolId) deferProductEvent("school_linked", { link_type: "student_context" });

    return NextResponse.json({ student }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}
