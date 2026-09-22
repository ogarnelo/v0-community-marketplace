import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, diagnostic: "connect-route" });
}

export async function POST() {
  return NextResponse.json({ ok: false, diagnostic: "connect-route" }, { status: 503 });
}
