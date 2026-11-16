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
import { getAdminFlags } from "@/lib/admin/roles";
import { provisionSchoolAdminAccess } from "@/lib/admin/school-admin-invitation";
import { getAuthPublicOrigin } from "@/lib/auth/public-origin";

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

    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id);

    if (roleError) return privateJson({ error: "No se pudo comprobar tu permiso." }, { status: 503 });

    const adminFlags = getAdminFlags({
      email: user.email,
      roles: (roles || []) as Array<{ role: string; school_id: string | null }>,
    });

    if (!adminFlags.isSuperAdmin) {
      return privateJson({ error: "Solo superadmin puede enviar invitaciones." }, { status: 403 });
    }

    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const schoolId = typeof body?.schoolId === "string" ? body.schoolId.trim() : "";
    const schoolName = typeof body?.schoolName === "string" ? body.schoolName.trim() : "";

    if (!email || !schoolId) {
      return privateJson({ error: "Faltan email o schoolId." }, { status: 400 });
    }

    const access = await provisionSchoolAdminAccess({
      email,
      schoolId,
      schoolName: schoolName || "tu centro",
      origin: getAuthPublicOrigin(),
      idempotencyKeyPrefix: `school-admin-direct-${schoolId}-${Date.now()}`,
    });

    return privateJson({
      ok: true,
      invited: access.activationSent,
      message: access.existingConfirmedUser
        ? "La cuenta ya existía y ya tiene acceso de administración del centro."
        : "Se ha enviado un enlace para activar la cuenta y crear la contraseña.",
    });
  } catch {
    console.error("school_admin_invitation_failed");
    return privateJson({ error: "No se pudo enviar la invitación al colegio." }, { status: 500 });
  }
}
