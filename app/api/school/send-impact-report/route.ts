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
import { sendMonthlySchoolImpactEmail } from "@/lib/emails/school-impact-report-email";
import {
  loadSchoolImpactReport,
  previousCalendarMonth,
  renderSchoolImpactPdf,
} from "@/lib/reports/school-impact-report";

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
      return privateJson(
        { error: "No tienes un centro administrable." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | { email?: string }
      | null;

    const email = (body?.email || user.email || "").trim().toLowerCase();

    // Only the authenticated user's verified address may receive school reports.
    // A supplied address cannot redirect a report to an arbitrary third party.
    const verifiedEmail = user.email_confirmed_at ? (user.email || "").trim().toLowerCase() : "";
    if (!verifiedEmail || email !== verifiedEmail) {
      return privateJson({ error: "Solo puedes usar el email verificado de tu cuenta." }, { status: 403 });
    }

    if (!isEmail(email)) {
      return privateJson(
        { error: "Introduce un email válido." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, is_active")
      .eq("id", schoolRole.school_id)
      .maybeSingle();

    if (schoolError) throw schoolError;

    if (!school || school.is_active === false) {
      return privateJson(
        { error: "El centro está desactivado." },
        { status: 400 }
      );
    }

    const period = previousCalendarMonth();
    const report = await loadSchoolImpactReport({
      schoolId: schoolRole.school_id,
      start: period.start,
      end: period.end,
      periodLabel: period.label,
      periodKey: period.key,
    });
    // A centre may be deactivated while its metrics are being loaded.
    if (!report?.school || report.school.is_active !== true) {
      return privateJson({ error: "Centro no disponible." }, { status: 403 });
    }

    const pdf = renderSchoolImpactPdf(report);

    const emailResult = await sendMonthlySchoolImpactEmail({
      to: email,
      report,
      pdf,
    });

    const providerMessageId =
      emailResult && typeof emailResult === "object" && "id" in emailResult && typeof emailResult.id === "string"
        ? emailResult.id
        : null;

    const { error: deliveryError } = await admin
      .from("school_impact_report_deliveries")
      .insert({
        school_id: schoolRole.school_id,
        user_id: user.id,
        email,
        period_key: period.key,
        period_label: period.label,
        source: "manual",
        provider_message_id: providerMessageId,
      });

    if (deliveryError) {
      // Email is already accepted. Keep updating last_sent_month to avoid an
      // automatic duplicate, then expose the missing delivery audit explicitly.
      console.error("school_impact_manual_delivery_record_failed");
    }

    const { data: existingSubscription, error: subscriptionReadError } = await admin
      .from("school_impact_report_subscriptions")
      .select("enabled, day_of_month")
      .eq("school_id", schoolRole.school_id)
      .eq("user_id", user.id)
      .maybeSingle<{ enabled: boolean; day_of_month: number }>();

    if (subscriptionReadError) {
      // The provider already accepted the email. Do not misreport this as a
      // failed send: a retry could deliver the same private PDF twice.
      return privateJson(
        { error: "El informe se envió, pero no se pudo conciliar la suscripción. Revisa el historial antes de repetir." },
        { status: 503 }
      );
    }

    const { error: subscriptionWriteError } = await admin
      .from("school_impact_report_subscriptions")
      .upsert(
        {
          school_id: schoolRole.school_id,
          user_id: user.id,
          email,
          enabled: existingSubscription?.enabled ?? false,
          day_of_month: existingSubscription?.day_of_month ?? 1,
          last_sent_month: period.key,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "school_id,user_id" }
      );

    if (subscriptionWriteError) {
      return privateJson(
        { error: "El informe se envió, pero no se pudo actualizar la suscripción. Revisa el historial antes de repetir." },
        { status: 503 }
      );
    }

    if (deliveryError) {
      return privateJson(
        { error: "El informe se envió, pero no se pudo registrar su entrega. Revisa el historial antes de repetir." },
        { status: 503 }
      );
    }

    return privateJson({
      ok: true,
      period: period.label,
      periodKey: period.key,
      message: `Informe de ${period.label} enviado a ${email}.`,
    });
  } catch {
    console.error("school_impact_manual_send_failed");
    return privateJson({ error: "No se pudo enviar el informe." }, { status: 500 });
  }
}
