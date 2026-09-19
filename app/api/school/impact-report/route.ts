import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  dashboardRange,
  loadSchoolImpactReport,
  renderSchoolImpactPdf,
} from "@/lib/reports/school-impact-report";

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const rawRange = url.searchParams.get("range");
    const range = rawRange === "90d" || rawRange === "total" ? rawRange : "365d";

    const schoolAdminRole = (roles || []).find(
      (role) => role.role === "school_admin" && role.school_id
    );
    const isSuperAdmin = (roles || []).some((role) => role.role === "super_admin");

    const requestedSchoolId = url.searchParams.get("school_id")?.trim() || null;
    const schoolId =
      schoolAdminRole?.school_id || (isSuperAdmin ? requestedSchoolId : null);

    if (!schoolId) {
      return NextResponse.json({ error: "No tienes un centro administrable." }, { status: 403 });
    }

    const window = dashboardRange(range);
    const report = await loadSchoolImpactReport({
      schoolId,
      start: window.start,
      end: window.end,
      periodLabel: window.label,
      periodKey: window.key,
    });

    const pdf = renderSchoolImpactPdf(report);
    const filename = `wetudy-impacto-${safeFilename(report.school.name) || "centro"}-${report.periodKey}.pdf`;

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: any) {
    console.error("Error generando PDF de impacto:", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo generar el PDF." },
      { status: 500 }
    );
  }
}
