import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const guest = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return privateJson({ error: guest ? "No autenticado." : "No se pudo comprobar tu sesión." }, guest ? 401 : 503);
    }
    const user = data?.user;
    if (!user) return privateJson({ error: "No autenticado." }, 401);

    const body = await request.json().catch(() => null);
    const notificationId = typeof body?.notificationId === "string" ? body.notificationId.trim() : "";
    if (!notificationId) return privateJson({ error: "Falta la notificación." }, 400);

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) return privateJson({ error: "No se pudo actualizar la notificación." }, 503);
    return privateJson({ ok: true });
  } catch {
    return privateJson({ error: "No se pudo completar la operación." }, 503);
  }
}
