import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_STATUSES = new Set(["draft", "published", "noindex", "archived"]);
const FALLBACK_SUPERADMIN_EMAILS = ["oscar_garnelo@hotmail.com"];

export const dynamic = "force-dynamic";

async function canAccess(userId: string, email?: string | null) {
  const admin = createAdminClient();

  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();

  if (data?.role === "super_admin") return true;

  const envEmails = process.env.SUPERADMIN_EMAILS?.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean) || [];
  const allowed = new Set([...FALLBACK_SUPERADMIN_EMAILS, ...envEmails].map((item) => item.toLowerCase()));
  return Boolean(email && allowed.has(email.toLowerCase()));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await canAccess(user.id, user.email))) {
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
    .from("seo_programmatic_pages")
    .update({
      status,
      reviewed_by: user.id,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    console.error("seo_page_update_error", error);
    return NextResponse.json({ error: "No se pudo actualizar la página." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
