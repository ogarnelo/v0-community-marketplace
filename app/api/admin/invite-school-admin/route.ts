import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminFlags } from "@/lib/admin/roles";

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

    const adminSupabase = createAdminClient();
    const origin = new URL(request.url).origin;

    const { error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/admin/school`,
      data: {
        pending_school_admin_role: "school_admin",
        pending_school_admin_school_id: schoolId,
        school_name: schoolName || null,
      },
    });

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message ||
            "No se pudo enviar la invitación al colegio. Revisa si el usuario ya existe.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
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
