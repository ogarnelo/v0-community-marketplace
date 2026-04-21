
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const targetUserId = String(body?.targetUserId || "");

  if (!targetUserId || targetUserId === user.id) {
    return NextResponse.json({ error: "Invalid target user" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("user_follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("user_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, following: false });
  }

  const [{ error: insertError }, { data: profile }] = await Promise.all([
    supabase.from("user_follows").insert({
      follower_id: user.id,
      following_id: targetUserId,
    }),
    supabase
      .from("profiles")
      .select("full_name, business_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const followerName =
    profile?.business_name?.trim() ||
    profile?.full_name?.trim() ||
    user.user_metadata?.full_name ||
    "Un usuario";

  await createNotification(supabase, {
    user_id: targetUserId,
    kind: "new_follower",
    title: "Tienes un nuevo seguidor",
    body: `${followerName} ha empezado a seguir tu perfil.`,
    href: `/profile/${user.id}`,
    metadata: { follower_id: user.id },
  });

  return NextResponse.json({ ok: true, following: true });
}
