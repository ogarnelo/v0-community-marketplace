import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, {
    ...options,
    headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) },
  });
}

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
      return privateJson({ error: "No tienes un centro administrable." }, { status: 403 });
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
  } catch {
    console.error("school_impact_pdf_failed");
    return privateJson({ error: "No se pudo generar el PDF." }, { status: 500 });
  }
}
