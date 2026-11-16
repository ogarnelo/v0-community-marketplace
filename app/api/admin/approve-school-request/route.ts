import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(payload: unknown, opts: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(payload, {
    ...opts,
    headers: { ...PRIVATE_HEADERS, ...(opts.headers || {}) },
  });
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionSchoolAdminAccess } from "@/lib/admin/school-admin-invitation";
import { getAuthPublicOrigin } from "@/lib/auth/public-origin";

type SchoolRequestRow = {
  id: string;
  school_name: string;
  contact_email: string | null;
  approved_school_id: string | null;
  status: string | null;
};

type ApproveSchoolResult = {
  school_id: string | null;
  access_code: string | null;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const guest = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return privateJson(
        { error: guest ? "No autenticado." : "No se pudo comprobar tu sesión." },
        { status: guest ? 401 : 503 }
      );
    }
    const user = authData?.user ?? null;

    if (!user) {
      return privateJson({ error: "No autenticado." }, { status: 401 });
    }

    const { data: superAdminRoles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1);

    if (roleError) return privateJson({ error: "No se pudo comprobar tu permiso." }, { status: 503 });

    if (roleError || !superAdminRoles?.length) {
      return privateJson({ error: "No autorizado." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as {
      requestId?: string;
    } | null;

    const requestId = body?.requestId?.trim();

    if (!requestId) {
      return privateJson(
        { error: "Falta el identificador de la solicitud." },
        { status: 400 }
      );
    }

    const { data: schoolRequest, error: requestError } = await supabase
      .from("school_registration_requests")
      .select("id, school_name, contact_email, approved_school_id, status")
      .eq("id", requestId)
      .maybeSingle<SchoolRequestRow>();

    if (requestError) {
      throw requestError;
    }

    if (!schoolRequest) {
      return privateJson(
        { error: "No se ha encontrado la solicitud indicada." },
        { status: 404 }
      );
    }

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase.rpc(
      "server_approve_school_registration_request",
      {
        request_id: requestId,
        reviewer_id: user.id,
      }
    );

    if (error) {
      throw error;
    }

    const result = (Array.isArray(data) ? data[0] : data) as ApproveSchoolResult | null;
    const approvedSchoolId =
      result?.school_id || schoolRequest.approved_school_id || null;
    const accessCode = result?.access_code || null;

    let inviteSent = false;
    let inviteMessage: string | null = null;

    const normalizedContactEmail = schoolRequest.contact_email?.trim().toLowerCase() || null;

    if (normalizedContactEmail && approvedSchoolId) {
      const access = await provisionSchoolAdminAccess({
        email: normalizedContactEmail,
        schoolId: approvedSchoolId,
        schoolName: schoolRequest.school_name,
        origin: getAuthPublicOrigin(),
        idempotencyKeyPrefix: `school-admin-${schoolRequest.id}`,
      });

      inviteSent = access.activationSent;
      inviteMessage = access.existingConfirmedUser
        ? "La cuenta ya existía. Se le ha concedido acceso de administración del centro."
        : "Se ha enviado un email corporativo para activar la cuenta, crear contraseña y entrar al panel del centro.";
    }

    return privateJson({
      ok: true,
      school_id: approvedSchoolId,
      access_code: accessCode,
      invite_sent: inviteSent,
      invite_message: inviteMessage,
    });
  } catch {
    console.error("school_approval_failed");
    return privateJson({ error: "No se pudo aprobar la solicitud de centro." }, { status: 500 });
  }
}
