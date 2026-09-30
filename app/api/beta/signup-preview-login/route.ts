import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSafeInternalPath } from "@/lib/auth/safe-next";

type PreviewType = "parent" | "student";

function accountFor(type: PreviewType) {
  return type === "student"
    ? {
        email: "wetudy-signup-student-preview@example.com",
        firstName: "Wetudy",
        lastName: "Student Preview",
        userType: "student" as const,
      }
    : {
        email: "wetudy-signup-parent-preview@example.com",
        firstName: "Wetudy",
        lastName: "Family Preview",
        userType: "parent" as const,
      };
}

function isAlreadyRegistered(message: string | undefined) {
  return Boolean(message && /already|registered|exists/i.test(message));
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse("Not found", { status: 404 });
  }

  const requestUrl = new URL(request.url);
  const requestedType =
    requestUrl.searchParams.get("type") === "student" ? "student" : "parent";
  const account = accountFor(requestedType);
  const safeNext =
    getSafeInternalPath(requestUrl.searchParams.get("next")) ||
    "/onboarding/students";

  const admin = createAdminClient();

  const { error: createError } = await admin.auth.admin.createUser({
    email: account.email,
    email_confirm: true,
    user_metadata: {
      first_name: account.firstName,
      last_name: account.lastName,
      full_name: account.firstName + " " + account.lastName,
      user_type: account.userType,
      postal_code: "28001",
      wetudy_signup_preview: true,
    },
    app_metadata: {
      wetudy_signup_preview: true,
    },
  });

  if (createError && !isAlreadyRegistered(createError.message)) {
    console.error("Signup preview: no se pudo crear cuenta técnica", createError);
    return NextResponse.redirect(
      new URL("/auth?auth_error=signup_preview_account", request.url)
    );
  }

  const { data: usersPage, error: listError } =
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    console.error("Signup preview: no se pudo localizar cuenta técnica", listError);
    return NextResponse.redirect(
      new URL("/auth?auth_error=signup_preview_account", request.url)
    );
  }

  const testUser = usersPage.users.find(
    (user) => user.email?.toLowerCase() === account.email
  );

  if (!testUser) {
    return NextResponse.redirect(
      new URL("/auth?auth_error=signup_preview_account", request.url)
    );
  }

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(
    testUser.id,
    {
      user_metadata: {
        ...(testUser.user_metadata || {}),
        first_name: account.firstName,
        last_name: account.lastName,
        full_name: account.firstName + " " + account.lastName,
        user_type: account.userType,
        postal_code: "28001",
        wetudy_signup_preview: true,
      },
      app_metadata: {
        ...(testUser.app_metadata || {}),
        wetudy_signup_preview: true,
      },
    }
  );

  if (authUpdateError) {
    console.error("Signup preview: no se pudo actualizar Auth", authUpdateError);
    return NextResponse.redirect(
      new URL("/auth?auth_error=signup_preview_auth", request.url)
    );
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: testUser.id,
      first_name: account.firstName,
      last_name: account.lastName,
      full_name: account.firstName + " " + account.lastName,
      user_type: account.userType,
      postal_code: "28001",
      grade_level: null,
      school_id: null,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("Signup preview: no se pudo preparar perfil", profileError);
    return NextResponse.redirect(
      new URL("/auth?auth_error=signup_preview_profile", request.url)
    );
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: account.email,
    });

  const tokenHash = linkData?.properties?.hashed_token;

  if (linkError || !tokenHash) {
    console.error("Signup preview: no se pudo generar token", linkError);
    return NextResponse.redirect(
      new URL("/auth?auth_error=signup_preview_token", request.url)
    );
  }

  const supabase = await createClient();
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (verifyError || !verifyData.session || !verifyData.user) {
    console.error("Signup preview: no se pudo crear sesión", verifyError);
    return NextResponse.redirect(
      new URL("/auth?auth_error=signup_preview_session", request.url)
    );
  }

  return NextResponse.redirect(new URL(safeNext, request.url));
}
