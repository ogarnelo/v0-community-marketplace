import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const listings = Array.isArray(body?.listings) ? body.listings : [];

  if (!listings.length) {
    return NextResponse.json({ error: "No listings provided" }, { status: 400 });
  }

  const payload = listings.map((l: any) => ({
    ...l,
    seller_id: user.id,
    status: "available",
  }));

  const { error } = await supabase.from("listings").insert(payload);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
