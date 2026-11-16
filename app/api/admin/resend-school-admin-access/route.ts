import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}

import { createClient } from "@/lib/supabase/server";
import { provisionSchoolAdminAccess } from "@/lib/admin/school-admin-invitation";
import { getAuthPublicOrigin } from "@/lib/auth/public-origin";

type ApprovedSchoolRequest = {
  id: string;
  school_name: string;
  contact_email: string | null;
  approved_school_id: string | null;
  status: string | null;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const missingSession = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return privateJson(
        { error: missingSession ? "No autenticado." : "No se pudo comprobar tu sesión." },
        { status: missingSession ? 401 : 503 }
      );
    }
    const user = authData?.user ?? null;

    if (!user) {
      return privateJson({ error: "No autenticado." }, { status: 401 });
    }

    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1);

    if (roleError) return privateJson({ error: "No se pudo comprobar tu permiso." }, { status: 503 });

    if (roleError || !roles?.length) {
      return privateJson({ error: "No autorizado." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as { requestId?: string } | null;
    const requestId = body?.requestId?.trim();

    if (!requestId) {
      return privateJson({ error: "Falta la solicitud." }, { status: 400 });
    }

    const { data: schoolRequest, error: requestError } = await supabase
      .from("school_registration_requests")
      .select("id, school_name, contact_email, approved_school_id, status")
      .eq("id", requestId)
      .maybeSingle<ApprovedSchoolRequest>();

    if (requestError) throw requestError;

    if (
      !schoolRequest ||
      schoolRequest.status !== "approved" ||
      !schoolRequest.approved_school_id ||
      !schoolRequest.contact_email
    ) {
      return privateJson(
        { error: "La solicitud aprobada no tiene un acceso de centro reenviable." },
        { status: 400 }
      );
    }

    const access = await provisionSchoolAdminAccess({
      email: schoolRequest.contact_email,
      schoolId: schoolRequest.approved_school_id,
      schoolName: schoolRequest.school_name,
      origin: getAuthPublicOrigin(),
      idempotencyKeyPrefix: `school-admin-resend-${schoolRequest.id}-${Date.now()}`,
    });

    return privateJson({
      ok: true,
      activation_sent: access.activationSent,
      message: access.existingConfirmedUser
        ? "Acceso confirmado y email enviado."
        : "Nuevo enlace de activación enviado.",
    });
  } catch {
    console.error("school_access_resend_failed");
    return privateJson({ error: "No se pudo reenviar el acceso del centro." }, { status: 500 });
  }
}
