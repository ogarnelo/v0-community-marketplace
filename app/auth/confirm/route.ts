import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeInternalPath } from "@/lib/auth/safe-next";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const safeNext = getSafeInternalPath(request.nextUrl.searchParams.get("next"));

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL("/auth?auth_error=invalid_link", request.url)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/auth?auth_error=invalid_link", request.url)
    );
  }

  const fallbackDestination =
    type === "recovery"
      ? "/auth/update-password"
      : type === "invite" || type === "magiclink"
        ? "/auth/complete-invite?next=/admin/school"
        : "/onboarding/join-school";
  const destination = safeNext || fallbackDestination;

  const redirectTo = new URL(destination, request.url);
  return NextResponse.redirect(redirectTo);
}
