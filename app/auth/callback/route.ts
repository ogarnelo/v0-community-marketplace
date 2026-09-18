import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildFullName, normalizeNamePart, splitLegacyFullName } from "@/lib/users/person-name";
import { getSafeInternalPath } from "@/lib/auth/safe-next";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const safeNext = getSafeInternalPath(requestUrl.searchParams.get("next"));

  const supabase = await createClient();

  if (!code) {
    return NextResponse.redirect(new URL("/auth?auth_error=invalid_link", request.url));
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(new URL("/auth?auth_error=invalid_link", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth?auth_error=invalid_link", request.url));
  }

  {
    const metadata = user.user_metadata || {};
    const legacyName = splitLegacyFullName(
      typeof metadata.full_name === "string" ? metadata.full_name : null
    );
    const firstName = normalizeNamePart(
      typeof metadata.first_name === "string" ? metadata.first_name : legacyName.firstName
    );
    const lastName = normalizeNamePart(
      typeof metadata.last_name === "string" ? metadata.last_name : legacyName.lastName
    );
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
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: buildFullName(firstName, lastName),
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
