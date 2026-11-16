import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
import { createClient } from "@/lib/supabase/server";
import {
  AccountStudentError,
  deactivateAccountStudent,
  parseStudentInput,
  updateAccountStudent,
} from "@/lib/account-students/server";

function errorResponse(error: unknown) {
  if (error instanceof AccountStudentError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: PRIVATE_HEADERS }
    );
  }

  console.error("Error actualizando estudiante de cuenta:", error);
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const input = parseStudentInput(body);
    const student = await updateAccountStudent(user.id, id, input);

    return NextResponse.json({ student }, { headers: PRIVATE_HEADERS });
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
    const student = await deactivateAccountStudent(user.id, id);

    return NextResponse.json({ student }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}
