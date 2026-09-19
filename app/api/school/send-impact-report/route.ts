import { NextResponse } from "next/server";
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
      return NextResponse.json(
        { error: "No tienes un centro administrable." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | { email?: string }
      | null;

    const email = (body?.email || user.email || "").trim().toLowerCase();

    if (!isEmail(email)) {
      return NextResponse.json(
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
      return NextResponse.json(
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
    const pdf = renderSchoolImpactPdf(report);

    await sendMonthlySchoolImpactEmail({
      to: email,
      report,
      pdf,
    });

    const { data: existingSubscription, error: subscriptionReadError } = await admin
      .from("school_impact_report_subscriptions")
      .select("enabled, day_of_month")
      .eq("school_id", schoolRole.school_id)
      .eq("user_id", user.id)
      .maybeSingle<{ enabled: boolean; day_of_month: number }>();

    if (subscriptionReadError) throw subscriptionReadError;

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

    if (subscriptionWriteError) throw subscriptionWriteError;

    return NextResponse.json({
      ok: true,
      period: period.label,
      periodKey: period.key,
      message: `Informe de ${period.label} enviado a ${email}.`,
    });
  } catch (error: any) {
    console.error("Error enviando informe de impacto manual:", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo enviar el informe." },
      { status: 500 }
    );
  }
}
