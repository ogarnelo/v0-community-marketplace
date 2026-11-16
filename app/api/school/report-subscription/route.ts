import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, {
    ...options,
    headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) },
  });
}

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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

    const schoolRole = (roles || []).find(
      (role) => role.role === "school_admin" && role.school_id
    );

    if (!schoolRole?.school_id) {
      return privateJson({ error: "No tienes un centro administrable." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as
      | { enabled?: boolean; email?: string; dayOfMonth?: number }
      | null;

    const enabled = body?.enabled === true;
    const email = (body?.email || user.email || "").trim().toLowerCase();
    const dayOfMonth = Number(body?.dayOfMonth || 1);

    if (!isEmail(email)) {
      return privateJson({ error: "Introduce un email válido." }, { status: 400 });
    }

    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
      return privateJson({ error: "El día debe estar entre 1 y 28." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, is_active")
      .eq("id", schoolRole.school_id)
      .maybeSingle();

    if (schoolError) throw schoolError;
    if (!school || school.is_active === false) {
      return privateJson({ error: "El centro está desactivado." }, { status: 400 });
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

    return privateJson({
      ok: true,
      message: enabled
        ? `Informe mensual activado para el día ${dayOfMonth}.`
        : "Informe mensual desactivado.",
    });
  } catch {
    console.error("school_impact_subscription_failed");
    return privateJson({ error: "No se pudo guardar la configuración." }, { status: 500 });
  }
}
