import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();

  const requiredPublicEnvOk = Boolean(
    process.env.NEXT_PUBLIC_APP_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );

  let supabaseOk = false;

  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .limit(1);

    supabaseOk = !error;
  } catch {
    supabaseOk = false;
  }

  const ok = requiredPublicEnvOk && supabaseOk;

  return NextResponse.json(
    {
      ok,
      service: "wetudy",
      checks: {
        publicEnv: requiredPublicEnvOk,
        supabase: supabaseOk,
      },
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
