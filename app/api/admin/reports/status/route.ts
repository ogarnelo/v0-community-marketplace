import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_STATUSES = new Set(["open", "reviewing", "resolved", "dismissed"]);

function normalizeRpcRow<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
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

    const body = await request.json().catch(() => ({}));
    const reportId = typeof body?.reportId === "string" ? body.reportId.trim() : "";
    const status = typeof body?.status === "string" ? body.status.trim() : "";

    if (!reportId || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Estado de incidencia no válido." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("server_update_report_status", {
      p_actor_id: user.id,
      p_report_id: reportId,
      p_status: status,
    });

    if (error) {
      const message = error.message || "No se pudo actualizar la incidencia.";
      const lower = message.toLowerCase();

      if (lower.includes("report not found")) {
        return NextResponse.json({ error: "No se encontró la incidencia." }, { status: 404 });
      }
      if (lower.includes("not allowed")) {
        return NextResponse.json({ error: "No autorizado." }, { status: 403 });
      }

      throw error;
    }

    const report = normalizeRpcRow<any>(data);
    return NextResponse.json({ ok: true, report });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo actualizar la incidencia." },
      { status: 500 }
    );
  }
}
