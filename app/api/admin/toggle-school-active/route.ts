import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1);

    if (roleError || !roles?.length) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as
      | { schoolId?: string; active?: boolean }
      | null;

    const schoolId = body?.schoolId?.trim();
    const active = body?.active;

    if (!schoolId || typeof active !== "boolean") {
      return NextResponse.json({ error: "Faltan datos del centro." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, name, is_active")
      .eq("id", schoolId)
      .maybeSingle();

    if (schoolError) throw schoolError;
    if (!school) {
      return NextResponse.json({ error: "Centro no encontrado." }, { status: 404 });
    }

    const { error: updateSchoolError } = await admin
      .from("schools")
      .update({ is_active: active })
      .eq("id", schoolId);

    if (updateSchoolError) throw updateSchoolError;

    if (!active) {
      const [{ error: accessCodeError }, { error: subscriptionError }] = await Promise.all([
        admin
          .from("school_access_codes")
          .update({ is_active: false })
          .eq("school_id", schoolId),
        admin
          .from("school_impact_report_subscriptions")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("school_id", schoolId),
      ]);

      if (accessCodeError) throw accessCodeError;
      if (subscriptionError && subscriptionError.code !== "42P01") throw subscriptionError;
    } else {
      const { data: activeCode } = await admin
        .from("school_access_codes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!activeCode) {
        const { data: latestCode, error: latestCodeError } = await admin
          .from("school_access_codes")
          .select("id")
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestCodeError) throw latestCodeError;

        if (latestCode?.id) {
          const { error: reactivateCodeError } = await admin
            .from("school_access_codes")
            .update({ is_active: true })
            .eq("id", latestCode.id);

          if (reactivateCodeError) throw reactivateCodeError;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      active,
      message: active
        ? "Centro reactivado. El acceso de la comunidad vuelve a estar disponible."
        : "Centro desactivado. Se han suspendido sus códigos de acceso y reportes automáticos.",
    });
  } catch (error: any) {
    console.error("Error actualizando estado del centro:", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo actualizar el centro." },
      { status: 500 }
    );
  }
}
