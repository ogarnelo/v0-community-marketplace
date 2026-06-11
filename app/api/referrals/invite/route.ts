import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const email = body?.email;

  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  const { error } = await supabase.from("referrals").insert({
    referrer_id: user.id,
    invited_email: email,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
