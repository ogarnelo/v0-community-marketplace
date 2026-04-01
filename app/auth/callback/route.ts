import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : null;

  const supabase = await createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const metadata = user.user_metadata || {};

    await supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name:
          typeof metadata.full_name === "string" && metadata.full_name.trim().length > 0
            ? metadata.full_name.trim()
            : null,
        user_type:
          metadata.user_type === "parent" || metadata.user_type === "student"
            ? metadata.user_type
            : null,
        grade_level:
          typeof metadata.grade_level === "string" && metadata.grade_level.trim().length > 0
            ? metadata.grade_level.trim()
            : null,
        postal_code:
          typeof metadata.postal_code === "string" && metadata.postal_code.trim().length > 0
            ? metadata.postal_code.trim()
            : null,
      },
      {
        onConflict: "id",
      }
    );

    const pendingRole =
      typeof metadata.pending_school_admin_role === "string"
        ? metadata.pending_school_admin_role
        : null;
    const pendingSchoolId =
      typeof metadata.pending_school_admin_school_id === "string"
        ? metadata.pending_school_admin_school_id
        : null;

    if (pendingRole === "school_admin" && pendingSchoolId) {
      const adminSupabase = createAdminClient();

      const { data: existingRole } = await adminSupabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("role", "school_admin")
        .eq("school_id", pendingSchoolId)
        .maybeSingle();

      if (!existingRole) {
        await adminSupabase.from("user_roles").insert({
          user_id: user.id,
          role: "school_admin",
          school_id: pendingSchoolId,
        });
      }

      await adminSupabase
        .from("profiles")
        .update({ school_id: pendingSchoolId })
        .eq("id", user.id);
    }
  }

  return NextResponse.redirect(
    new URL(safeNext || "/onboarding/join-school", request.url)
  );
}
