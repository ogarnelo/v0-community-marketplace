import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminFlags } from "@/lib/admin/roles";
import { findAuthUserByEmail, grantSchoolAdminRole } from "@/lib/admin/school-admin-role";

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

    const existingUser = await findAuthUserByEmail(email);

    if (existingUser) {
      await grantSchoolAdminRole({
        userId: existingUser.id,
        schoolId,
      });

      return NextResponse.json({
        ok: true,
        invited: false,
        message: "La cuenta ya existía y ya tiene acceso de administración del centro.",
      });
    }

    const adminSupabase = createAdminClient();
    const origin = new URL(request.url).origin;

    const { data: inviteData, error } = await adminSupabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${origin}/auth/callback?next=/admin/school`,
        data: {
          school_name: schoolName || null,
        },
      }
    );

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message ||
            "No se pudo enviar la invitación al colegio.",
        },
        { status: 400 }
      );
    }

    const invitedUserId = inviteData.user?.id;

    if (!invitedUserId) {
      return NextResponse.json(
        { error: "La invitación se creó sin un usuario asociado." },
        { status: 500 }
      );
    }

    await grantSchoolAdminRole({
      userId: invitedUserId,
      schoolId,
    });

    return NextResponse.json({ ok: true, invited: true });
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
