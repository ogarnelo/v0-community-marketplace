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

    // An invalid or incomplete request must not silently disable a user's
    // scheduled report or reset its configured delivery day. The dashboard
    // always submits a concrete day. Require it rather than falling back to
    // day 1 on a partial request (even when only disabling a subscription).
    if (!body || typeof body.enabled !== "boolean" ||
        (body.email !== undefined && typeof body.email !== "string") ||
        !Number.isInteger(body.dayOfMonth)) {
      return privateJson({ error: "Configuración de informe inválida." }, { status: 400 });
    }
    const enabled = body.enabled;
    const email = (body.email || user.email || "").trim().toLowerCase();
    const dayOfMonth = body.dayOfMonth;

    // Only the authenticated user's verified address may receive school reports.
    // A supplied address cannot redirect a report to an arbitrary third party.
    const verifiedEmail = user.email_confirmed_at ? (user.email || "").trim().toLowerCase() : "";
    if (!verifiedEmail || email !== verifiedEmail) {
      return privateJson({ error: "Solo puedes usar el email verificado de tu cuenta." }, { status: 403 });
    }

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
    if (!school || school.is_active !== true) {
      return privateJson({ error: "El centro está desactivado." }, { status: 400 });
    }

    // Authorizing a configuration mutation only at request start leaves a
    // gap: session, confirmed email, school role or school status can change
    // while privileged checks run. Revalidate before writing the subscription.
    const { data: freshAuth, error: freshAuthError } = await supabase.auth.getUser();
    if (freshAuthError) {
      return privateJson({ error: "No se pudo volver a comprobar tu sesión." }, { status: 503 });
    }
    const freshUser = freshAuth?.user;
    const freshEmail = freshUser?.email_confirmed_at
      ? (freshUser.email || "").trim().toLowerCase() : "";
    if (!freshUser || freshUser.id !== user.id || !freshEmail || freshEmail !== email) {
      return privateJson({ error: "La sesión o el correo verificado han cambiado." }, { status: 403 });
    }

    const { data: freshRoles, error: freshRoleError } = await supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id);
    if (freshRoleError || !Array.isArray(freshRoles)) {
      return privateJson({ error: "No se pudo comprobar tu permiso." }, { status: 503 });
    }
    if (!freshRoles.some(role => role.role === "school_admin" &&
        role.school_id === schoolRole.school_id)) {
      return privateJson({ error: "Permiso escolar revocado." }, { status: 403 });
    }

    const { data: freshSchool, error: freshSchoolError } = await admin
      .from("schools")
      .select("id, is_active")
      .eq("id", schoolRole.school_id)
      .maybeSingle();
    if (freshSchoolError) {
      return privateJson({ error: "No se pudo comprobar el colegio." }, { status: 503 });
    }
    if (!freshSchool || freshSchool.id !== schoolRole.school_id ||
        freshSchool.is_active !== true) {
      return privateJson({ error: "El colegio ya no está activo." }, { status: 403 });
    }

    // Never UPSERT an incomplete row here: on conflict PostgreSQL may write
    // the omitted last_sent_month default (NULL), allowing a duplicate report.
    // UPDATE changes configuration fields only, preserving the delivery marker.
    const { data: updated, error: updateError } = await admin
      .from("school_impact_report_subscriptions")
      .update({ email, enabled, day_of_month: dayOfMonth,
        updated_at: new Date().toISOString() })
      .eq("school_id", schoolRole.school_id)
      .eq("user_id", user.id)
      .select("id").maybeSingle();
    if (updateError) return privateJson({ error: "No se pudo guardar la configuración." }, { status: 503 });

    if (!updated?.id) {
      // Only a missing row may be inserted. A concurrent creator wins the
      // existing UNIQUE key; do not overwrite its monthly delivery marker.
      const { error: insertError } = await admin
        .from("school_impact_report_subscriptions")
        .insert({ school_id: schoolRole.school_id, user_id: user.id,
          email, enabled, day_of_month: dayOfMonth,
          updated_at: new Date().toISOString() });
      if (insertError?.code === "23505")
        return privateJson({ error: "La configuración cambió. Vuelve a consultarla." }, { status: 409 });
      if (insertError)
        return privateJson({ error: "No se pudo guardar la configuración." }, { status: 503 });
    }

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
