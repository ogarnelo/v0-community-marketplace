import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildFullName, normalizeNamePart, splitLegacyFullName } from "@/lib/users/person-name";
import { getSafeInternalPath } from "@/lib/auth/safe-next";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanGrowthLabel, cleanGrowthPath } from "@/lib/growth/attribution";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const safeNext = getSafeInternalPath(requestUrl.searchParams.get("next"));

  const supabase = await createClient();

  if (!code) {
    return NextResponse.redirect(new URL("/auth?auth_error=invalid_link", request.url));
  }

  const { data: exchangeData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(new URL("/auth?auth_error=invalid_link", request.url));
  }

  // exchangeCodeForSession already returns the authenticated user. Reading the
  // just-written auth cookies again inside the same request can race on some
  // browsers/mail webviews and incorrectly make a valid confirmation look
  // expired even though Supabase has already confirmed the account.
  const user = exchangeData.user || exchangeData.session?.user || null;

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
      },
      {
        onConflict: "id",
      }
    );

    const acquisitionSource = cleanGrowthLabel(
      metadata.wetudy_acquisition_source,
      120
    );

    if (acquisitionSource) {
      const admin = createAdminClient();
      const { error: attributionError } = await admin
        .from("growth_acquisition_events")
        .insert({
          event_type: "attributed_user",
          user_id: user.id,
          source: acquisitionSource,
          medium: cleanGrowthLabel(metadata.wetudy_acquisition_medium, 120),
          campaign: cleanGrowthLabel(metadata.wetudy_acquisition_campaign, 160),
          content: cleanGrowthLabel(metadata.wetudy_acquisition_content, 160),
          landing_path: cleanGrowthPath(metadata.wetudy_acquisition_landing_path),
        });

      if (attributionError && attributionError.code !== "23505") {
        console.error("No se pudo guardar la atribución del alta:", attributionError);
      }
    }

  }

  const destination =
    safeNext ||
    ((user?.user_metadata || {}).user_type === "business"
      ? "/account"
      : "/onboarding/join-school");

  return NextResponse.redirect(new URL(destination, request.url));
}
