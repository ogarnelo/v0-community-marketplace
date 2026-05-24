import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_STATUSES = new Set(["pending", "sent", "clicked", "dismissed"]);

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : "";

  if (!id || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  }

  const admin = createAdminClient();

  const updatePayload: Record<string, unknown> = {
    status,
  };

  if (status === "sent") updatePayload.sent_at = new Date().toISOString();
  if (status === "dismissed") updatePayload.dismissed_at = new Date().toISOString();

  const { error } = await admin
    .from("conversion_nudges")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "No se pudo actualizar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
