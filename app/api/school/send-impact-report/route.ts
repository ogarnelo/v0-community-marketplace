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

/**
 * Fail closed before every manual email attempt. Both the subscription marker
 * and its append-only delivery audit must agree that the month has not been
 * sent. An audit may exist even if updating last_sent_month failed.
 *
 * This is NOT an exclusive DB claim: two simultaneous manual requests can
 * still pass both reads. A reviewed transaction/claim is needed for that.
 */
async function manualMonthDeliveryState(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  userId: string,
  periodKey: string,
): Promise<"unsent" | "sent" | "unavailable"> {
  const [subscription, delivery] = await Promise.all([
    admin.from("school_impact_report_subscriptions")
      .select("last_sent_month")
      .eq("school_id", schoolId)
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("school_impact_report_deliveries")
      .select("id")
      .eq("school_id", schoolId)
      .eq("user_id", userId)
      .eq("period_key", periodKey)
      .limit(1)
      .maybeSingle(),
  ]);
  if (subscription.error || delivery.error) return "unavailable";
  return subscription.data?.last_sent_month === periodKey || Boolean(delivery.data?.id)
    ? "sent" : "unsent";
}

export async function POST(request: Request) {
  // Once the provider has accepted the email, an exception cannot safely be
  // presented as a failed send: the caller might retry a private PDF.
  let providerAccepted = false;
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

    if (!school || school.is_active !== true) {
      return privateJson(
        { error: "El centro está desactivado." },
        { status: 400 }
      );
    }

    const period = previousCalendarMonth();
    const initialDeliveryState = await manualMonthDeliveryState(
      admin, schoolRole.school_id, user.id, period.key
    );
    if (initialDeliveryState === "unavailable")
      return privateJson({ error: "No se pudo comprobar el historial del informe." }, { status: 503 });
    if (initialDeliveryState === "sent")
      return privateJson({ error: "Este periodo ya tiene un informe enviado. Revisa el historial." }, { status: 409 });

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

    // An authorization/verified-recipient change while generating the private
    // PDF must prevent an external email delivery. Re-read the live session,
    // the original school-admin grant and the active school immediately before
    // invoking the email provider; never rely on the initial checks alone.
    const { data: freshAuth, error: freshAuthError } = await supabase.auth.getUser();
    if (freshAuthError) {
      return privateJson({ error: "No se pudo comprobar tu sesión." }, { status: 503 });
    }
    const currentUser = freshAuth?.user;
    const currentEmail = currentUser?.email_confirmed_at
      ? (currentUser.email || "").trim().toLowerCase() : "";
    if (!currentUser || currentUser.id !== user.id || !currentEmail || currentEmail !== email) {
      return privateJson({ error: "Sesión o destinatario no autorizado." }, { status: 403 });
    }
    const { data: activeRoles, error: activeRoleError } = await supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id);
    if (activeRoleError || !Array.isArray(activeRoles)) {
      return privateJson({ error: "No se pudo comprobar tu permiso." }, { status: 503 });
    }
    if (!activeRoles.some(role => role.role === "school_admin" &&
        role.school_id === schoolRole.school_id)) {
      return privateJson({ error: "Permiso revocado." }, { status: 403 });
    }
    const { data: freshSchool, error: freshSchoolError } = await admin
      .from("schools")
      .select("id, is_active")
      .eq("id", schoolRole.school_id)
      .maybeSingle();
    if (freshSchoolError) {
      return privateJson({ error: "No se pudo comprobar el centro." }, { status: 503 });
    }
    if (!freshSchool || freshSchool.id !== schoolRole.school_id ||
        freshSchool.is_active !== true) {
      return privateJson({ error: "Centro no disponible." }, { status: 403 });
    }

    // The report can take time to generate. A second check catches manual
    // delivery or the cron marker committed after the original lookup.
    const freshDeliveryState = await manualMonthDeliveryState(
      admin, schoolRole.school_id, user.id, period.key
    );
    if (freshDeliveryState === "unavailable")
      return privateJson({ error: "No se pudo volver a comprobar el historial." }, { status: 503 });
    if (freshDeliveryState === "sent")
      return privateJson({ error: "El informe ya se ha enviado para este periodo." }, { status: 409 });

    const emailResult = await sendMonthlySchoolImpactEmail({
      to: email,
      report,
      pdf,
    });
    providerAccepted = true;

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
    // The provider has already accepted an external side effect. Do not
    // disclose provider/SQL details or signal a retry-safe failed delivery.
    console.error(providerAccepted
      ? "school_impact_manual_postaccept_reconciliation_required"
      : "school_impact_manual_send_failed");
    if (providerAccepted) {
      return privateJson(
        { error: "El informe se envió, pero su registro requiere conciliación. Revisa el historial antes de repetir." },
        { status: 503 }
      );
    }
    return privateJson({ error: "No se pudo enviar el informe." }, { status: 500 });
  }
}
