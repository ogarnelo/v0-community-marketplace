import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
        full_name: metadata.full_name || null,
        user_type: metadata.user_type || null,
        grade_level: metadata.grade_level || null,
        postal_code: metadata.postal_code || null,
      },
      {
        onConflict: "id",
      }
    );
  }

  return NextResponse.redirect(
    new URL(safeNext || "/onboarding/join-school", request.url)
  );
}
