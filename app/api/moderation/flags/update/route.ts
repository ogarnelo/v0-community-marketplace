import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessSuperadmin } from "@/lib/admin/superadmin-access";

const ALLOWED_STATUSES = new Set(["open", "reviewing", "resolved", "dismissed"]);

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await canAccessSuperadmin(user.id, user.email))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : "";

  if (!id || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("moderation_flags")
    .update({
      status,
      reviewed_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null,
      reviewed_by: status === "resolved" || status === "dismissed" ? user.id : null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "No se pudo actualizar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
