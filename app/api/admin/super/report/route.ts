import { NextResponse } from "next/server";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, {
    ...options,
    headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) },
  });
}

import { createClient } from "@/lib/supabase/server";
import {
  loadSuperAdminReport,
  normalizeSuperAdminRange,
  renderSuperAdminCsv,
  renderSuperAdminPdf,
} from "@/lib/reports/super-admin-report";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    const guest = authError.name === "AuthSessionMissingError" ||
      authError.code === "session_not_found";
    return privateJson(
      { error: guest ? "No autorizado." : "No se pudo comprobar tu sesión." },
      { status: guest ? 401 : 503 }
    );
  }
  const user = authData?.user ?? null;

  if (!user) {
    return privateJson({ error: "No autorizado." }, { status: 401 });
  }

  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  if (roleError) return privateJson({ error: "No se pudo comprobar tu permiso." }, { status: 503 });

  if (roleError || !roles?.length) {
    return privateJson({ error: "No autorizado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const range = normalizeSuperAdminRange(url.searchParams.get("range"));
  const format = url.searchParams.get("format") === "csv" ? "csv" : "pdf";
  const report = await loadSuperAdminReport(range);
  const suffix = range === "total" ? "historico" : range;

  if (format === "csv") {
    return new Response(renderSuperAdminCsv(report), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wetudy-informe-global-${suffix}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return new Response(renderSuperAdminPdf(report), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="wetudy-informe-global-${suffix}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
  } catch {
    console.error("super_admin_report_export_failed");
    return privateJson({ error: "No se pudo generar el informe global." }, { status: 500 });
  }
}
