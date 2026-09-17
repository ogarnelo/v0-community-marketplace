import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function shortText(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  if (roleError || !roles?.length) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const diagnostic = {
    reason: shortText(body?.reason, 40),
    path: shortText(body?.path, 240),
    session: shortText(body?.session, 80),
    innerWidth: finiteNumber(body?.innerWidth),
    outerWidth: finiteNumber(body?.outerWidth),
    clientWidth: finiteNumber(body?.clientWidth),
    scrollWidth: finiteNumber(body?.scrollWidth),
    bodyScrollWidth: finiteNumber(body?.bodyScrollWidth),
    scrollX: finiteNumber(body?.scrollX),
    scrollY: finiteNumber(body?.scrollY),
    visualWidth: finiteNumber(body?.visualWidth),
    visualOffsetLeft: finiteNumber(body?.visualOffsetLeft),
    visualPageLeft: finiteNumber(body?.visualPageLeft),
    visualScale: finiteNumber(body?.visualScale),
    screenWidth: finiteNumber(body?.screenWidth),
    devicePixelRatio: finiteNumber(body?.devicePixelRatio),
    menuOpen: Boolean(body?.menuOpen),
    userAgent: shortText(body?.userAgent, 220),
  };

  console.info("[viewport-debug]", JSON.stringify(diagnostic));
  return NextResponse.json({ ok: true });
}
