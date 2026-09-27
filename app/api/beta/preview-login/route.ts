import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSafeInternalPath } from "@/lib/auth/safe-next";

const PREVIEW_TEST_EMAIL = "wetudy-preview-test@example.com";

function isAlreadyRegistered(message: string | undefined) {
  return Boolean(message && /already|registered|exists/i.test(message));
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse("Not found", { status: 404 });
  }

  const requestUrl = new URL(request.url);
  const safeNext =
    getSafeInternalPath(requestUrl.searchParams.get("next")) ||
    "/beta/onboarding-estudiantes";

  const admin = createAdminClient();

  const { error: createError } = await admin.auth.admin.createUser({
    email: PREVIEW_TEST_EMAIL,
    email_confirm: true,
    user_metadata: {
      first_name: "Wetudy",
      last_name: "Preview",
      full_name: "Wetudy Preview",
      user_type: "parent",
      postal_code: "28001",
      wetudy_preview_test: true,
    },
    app_metadata: {
      wetudy_preview_test: true,
    },
  });

  if (createError && !isAlreadyRegistered(createError.message)) {
    console.error("Preview login: no se pudo crear la cuenta técnica", createError);
    return NextResponse.redirect(
      new URL("/auth?auth_error=preview_test_account", request.url)
    );
  }

  const { data: usersPage, error: listError } =
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    console.error("Preview login: no se pudo localizar la cuenta técnica", listError);
    return NextResponse.redirect(
      new URL("/auth?auth_error=preview_test_account", request.url)
    );
  }

  const testUser = usersPage.users.find(
    (user) => user.email?.toLowerCase() === PREVIEW_TEST_EMAIL
  );

  if (!testUser) {
    return NextResponse.redirect(
      new URL("/auth?auth_error=preview_test_account", request.url)
    );
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: testUser.id,
      first_name: "Wetudy",
      last_name: "Preview",
      full_name: "Wetudy Preview",
      user_type: "parent",
      postal_code: "28001",
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("Preview login: no se pudo preparar el perfil técnico", profileError);
    return NextResponse.redirect(
      new URL("/auth?auth_error=preview_test_profile", request.url)
    );
  }

  const callbackUrl = new URL("/auth/callback", requestUrl.origin);
  callbackUrl.searchParams.set("next", safeNext);

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: PREVIEW_TEST_EMAIL,
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

  const actionLink = linkData?.properties?.action_link;

  if (linkError || !actionLink) {
    console.error("Preview login: no se pudo generar el enlace técnico", linkError);
    return NextResponse.redirect(
      new URL("/auth?auth_error=preview_test_link", request.url)
    );
  }

  return NextResponse.redirect(actionLink);
}
