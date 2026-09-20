import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  loadSuperAdminReport,
  normalizeSuperAdminRange,
  renderSuperAdminCsv,
  renderSuperAdminPdf,
} from "@/lib/reports/super-admin-report";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
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
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(renderSuperAdminPdf(report), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="wetudy-informe-global-${suffix}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
