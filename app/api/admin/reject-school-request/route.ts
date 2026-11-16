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
      return privateJson({ error: "No autenticado." }, { status: 401 });
    }

    const { data: superAdminRoles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1);

    if (roleError) return privateJson({ error: "No se pudo comprobar tu permiso." }, { status: 503 });

    if (roleError || !superAdminRoles?.length) {
      return privateJson({ error: "No autorizado." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as {
      requestId?: string;
      notes?: string | null;
    } | null;

    const requestId = body?.requestId?.trim();
    const notes =
      typeof body?.notes === "string" ? body.notes.trim().slice(0, 500) || null : null;

    if (!requestId) {
      return privateJson(
        { error: "Falta el identificador de la solicitud." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin.rpc("server_reject_school_registration_request", {
      request_id: requestId,
      reviewer_id: user.id,
      notes,
    });

    if (error) throw error;

    return privateJson({ ok: true });
  } catch {
    console.error("school_request_rejection_failed");
    return privateJson({ error: "No se pudo rechazar la solicitud de centro." }, { status: 500 });
  }
}
