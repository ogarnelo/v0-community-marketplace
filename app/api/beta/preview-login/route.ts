import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: PREVIEW_TEST_EMAIL,
    });

  const tokenHash = linkData?.properties?.hashed_token;

  if (linkError || !tokenHash) {
    console.error("Preview login: no se pudo generar el token técnico", linkError);
    return NextResponse.redirect(
      new URL("/auth?auth_error=preview_test_token", request.url)
    );
  }

  const supabase = await createClient();
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (verifyError || !verifyData.session || !verifyData.user) {
    console.error("Preview login: no se pudo verificar el token técnico", verifyError);
    return NextResponse.redirect(
      new URL("/auth?auth_error=preview_test_session", request.url)
    );
  }

  const {
    data: { user: verifiedUser },
  } = await supabase.auth.getUser();

  if (!verifiedUser || verifiedUser.id !== testUser.id) {
    console.error("Preview login: la sesión no quedó verificada");
    return NextResponse.redirect(
      new URL("/auth?auth_error=preview_test_session", request.url)
    );
  }

  return NextResponse.redirect(new URL(safeNext, request.url));
}
