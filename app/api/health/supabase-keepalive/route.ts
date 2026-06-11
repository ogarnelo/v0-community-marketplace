import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasValidHealthSecret(request: NextRequest) {
  const secret = process.env.LAUNCH_HEALTH_SECRET?.trim();

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const headerSecret = request.headers.get("x-health-secret");
  const querySecret = request.nextUrl.searchParams.get("secret");

  return headerSecret === secret || querySecret === secret;
}

export async function GET(request: NextRequest) {
  if (!hasValidHealthSecret(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized keepalive",
        message: "Configura LAUNCH_HEALTH_SECRET y llama esta ruta con ?secret=... o header x-health-secret.",
      },
      { status: 401 }
    );
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("listings").select("id").limit(1);

    if (error) {
      console.error("Supabase keepalive error:", error);
      return NextResponse.json({ ok: false, error: "Supabase keepalive failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      rows: data?.length ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Supabase keepalive exception:", error);
    return NextResponse.json({ ok: false, error: "Supabase keepalive failed" }, { status: 500 });
  }
}
