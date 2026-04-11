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
    const invitedSchoolId =
      typeof metadata.invited_school_id === "string" &&
        metadata.invited_school_id.trim().length > 0
        ? metadata.invited_school_id.trim()
        : null;
    const invitedRole =
      typeof metadata.invited_role === "string" && metadata.invited_role.trim().length > 0
        ? metadata.invited_role.trim()
        : null;

    await supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name: metadata.full_name || null,
        user_type:
          metadata.user_type === "parent" || metadata.user_type === "student" || metadata.user_type === "business"
            ? metadata.user_type
            : null,
        grade_level: metadata.grade_level || null,
        postal_code: metadata.postal_code || null,
        school_id: invitedSchoolId,
      },
      {
        onConflict: "id",
      }
    );

    if (invitedSchoolId && invitedRole === "school_admin") {
      const adminSupabase = createAdminClient();

      const { data: existingRole } = await adminSupabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("role", "school_admin")
        .eq("school_id", invitedSchoolId)
        .maybeSingle();

      if (!existingRole) {
        await adminSupabase.from("user_roles").insert({
          user_id: user.id,
          role: "school_admin",
          school_id: invitedSchoolId,
        });
      }

      await adminSupabase
        .from("profiles")
        .update({ school_id: invitedSchoolId })
        .eq("id", user.id);
    }
  }

  const destination =
    safeNext ||
    ((user?.user_metadata || {}).user_type === "business"
      ? "/account"
      : "/onboarding/join-school");

  return NextResponse.redirect(new URL(destination, request.url));
}
