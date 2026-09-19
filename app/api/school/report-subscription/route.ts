import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id);

    if (roleError) throw roleError;

    const schoolRole = (roles || []).find(
      (role) => role.role === "school_admin" && role.school_id
    );

    if (!schoolRole?.school_id) {
      return NextResponse.json({ error: "No tienes un centro administrable." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as
      | { enabled?: boolean; email?: string; dayOfMonth?: number }
      | null;

    const enabled = body?.enabled === true;
    const email = (body?.email || user.email || "").trim().toLowerCase();
    const dayOfMonth = Number(body?.dayOfMonth || 1);

    if (!isEmail(email)) {
      return NextResponse.json({ error: "Introduce un email válido." }, { status: 400 });
    }

    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
      return NextResponse.json({ error: "El día debe estar entre 1 y 28." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, is_active")
      .eq("id", schoolRole.school_id)
      .maybeSingle();

    if (schoolError) throw schoolError;
    if (!school || school.is_active === false) {
      return NextResponse.json({ error: "El centro está desactivado." }, { status: 400 });
    }

    const { error } = await admin
      .from("school_impact_report_subscriptions")
      .upsert(
        {
          school_id: schoolRole.school_id,
          user_id: user.id,
          email,
          enabled,
          day_of_month: dayOfMonth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "school_id,user_id" }
      );

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      message: enabled
        ? `Informe mensual activado para el día ${dayOfMonth}.`
        : "Informe mensual desactivado.",
    });
  } catch (error: any) {
    console.error("Error guardando suscripción de impacto:", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo guardar la configuración." },
      { status: 500 }
    );
  }
}
