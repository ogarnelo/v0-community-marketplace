import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, {
    ...options,
    headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) },
  });
}


const VALID_STATUSES = new Set(["open", "reviewing", "resolved", "dismissed"]);

function normalizeRpcRow<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const noSession = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return privateJson(
        { error: noSession ? "Debes iniciar sesión." : "No se pudo comprobar tu sesión." },
        { status: noSession ? 401 : 503 }
      );
    }
    const user = authData?.user ?? null;

    if (!user) {
      return privateJson({ error: "Debes iniciar sesión." }, { status: 401 });
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

    const body = await request.json().catch(() => ({}));
    const reportId = typeof body?.reportId === "string" ? body.reportId.trim() : "";
    const status = typeof body?.status === "string" ? body.status.trim() : "";
    const resolutionNote =
      typeof body?.resolutionNote === "string"
        ? body.resolutionNote.trim().slice(0, 1000)
        : null;

    if (!reportId || !VALID_STATUSES.has(status)) {
      return privateJson({ error: "Estado de incidencia no válido." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("server_update_report_status", {
      p_actor_id: user.id,
      p_report_id: reportId,
      p_status: status,
      p_resolution_note: resolutionNote || null,
    });

    if (error) {
      const message = error.message || "No se pudo actualizar la incidencia.";
      const lower = message.toLowerCase();

      if (lower.includes("report not found")) {
        return privateJson({ error: "No se encontró la incidencia." }, { status: 404 });
      }
      if (lower.includes("not allowed")) {
        return privateJson({ error: "No autorizado." }, { status: 403 });
      }

      throw error;
    }

    const report = normalizeRpcRow<any>(data);
    return privateJson({ ok: true, report });
  } catch {
    console.error("moderation_report_status_failed");
    return privateJson({ error: "No se pudo actualizar la incidencia." }, { status: 500 });
  }
}
