import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_STATUSES = new Set(["completed", "dismissed"]);

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : "";

  if (!id || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Actualización no válida." }, { status: 400 });
  }

  const admin = createAdminClient();

  const payload: Record<string, unknown> = {
    status,
  };

  if (status === "completed") payload.completed_at = new Date().toISOString();
  if (status === "dismissed") payload.dismissed_at = new Date().toISOString();

  const { error } = await admin
    .from("transaction_velocity_events")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "No se pudo actualizar la acción." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
