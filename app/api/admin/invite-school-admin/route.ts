import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminFlags } from "@/lib/admin/roles";
import { provisionSchoolAdminAccess } from "@/lib/admin/school-admin-invitation";
import { getAuthPublicOrigin } from "@/lib/auth/public-origin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id);

    const adminFlags = getAdminFlags({
      email: user.email,
      roles: (roles || []) as Array<{ role: string; school_id: string | null }>,
    });

    if (!adminFlags.isSuperAdmin) {
      return NextResponse.json({ error: "Solo superadmin puede enviar invitaciones." }, { status: 403 });
    }

    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const schoolId = typeof body?.schoolId === "string" ? body.schoolId.trim() : "";
    const schoolName = typeof body?.schoolName === "string" ? body.schoolName.trim() : "";

    if (!email || !schoolId) {
      return NextResponse.json({ error: "Faltan email o schoolId." }, { status: 400 });
    }

    const access = await provisionSchoolAdminAccess({
      email,
      schoolId,
      schoolName: schoolName || "tu centro",
      origin: getAuthPublicOrigin(),
      idempotencyKeyPrefix: `school-admin-direct-${schoolId}-${Date.now()}`,
    });

    return NextResponse.json({
      ok: true,
      invited: access.activationSent,
      message: access.existingConfirmedUser
        ? "La cuenta ya existía y ya tiene acceso de administración del centro."
        : "Se ha enviado un enlace para activar la cuenta y crear la contraseña.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          error?.details ||
          "No se pudo enviar la invitación al colegio.",
      },
      { status: 500 }
    );
  }
}
