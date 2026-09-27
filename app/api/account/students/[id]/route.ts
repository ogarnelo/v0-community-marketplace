import { NextResponse } from "next/server";
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
      { status: error.status }
    );
  }

  console.error("Error actualizando estudiante de cuenta:", error);
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

    return NextResponse.json({ student });
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

    return NextResponse.json({ student });
  } catch (error) {
    return errorResponse(error);
  }
}
