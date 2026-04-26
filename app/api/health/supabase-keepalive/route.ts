import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("listings").select("id").limit(1);

    if (error) {
      console.error("Supabase keepalive error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      rows: data?.length ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Supabase keepalive exception:", error);
    return NextResponse.json({ ok: false, error: error?.message || "Unknown error" }, { status: 500 });
  }
}
