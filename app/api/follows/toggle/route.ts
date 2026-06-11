import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";
import { isPostgresUniqueViolation, safeApiError } from "@/lib/api/safe-error";

async function hasRecentFollowNotification(supabase: Awaited<ReturnType<typeof createClient>>, targetUserId: string, followerId: string) {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("kind", "new_follower")
      .contains("metadata", { follower_id: followerId })
      .gte("created_at", since)
      .limit(1);

    return Boolean(data?.length);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "";

    if (!targetUserId || targetUserId === user.id) {
      return NextResponse.json({ error: "Invalid target user" }, { status: 400 });
    }

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", targetUserId)
      .maybeSingle();

    if (!targetProfile) {
      return NextResponse.json({ error: "El perfil no existe." }, { status: 404 });
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
        return safeApiError(error, "No se pudo dejar de seguir este perfil.", 500);
      }

      return NextResponse.json({ ok: true, following: false });
    }

    const [{ error: insertError }, { data: profile }] = await Promise.all([
      supabase.from("user_follows").insert({
        follower_id: user.id,
        following_id: targetUserId,
      }),
      supabase.from("profiles").select("full_name, business_name").eq("id", user.id).maybeSingle(),
    ]);

    if (insertError && !isPostgresUniqueViolation(insertError)) {
      return safeApiError(insertError, "No se pudo seguir este perfil.", 500);
    }

    const followerName =
      profile?.business_name?.trim() ||
      profile?.full_name?.trim() ||
      user.user_metadata?.full_name ||
      "Un usuario";

    if (!(await hasRecentFollowNotification(supabase, targetUserId, user.id))) {
      await createNotification(supabase, {
        user_id: targetUserId,
        kind: "new_follower",
        title: "Tienes un nuevo seguidor",
        body: `${followerName} ha empezado a seguir tu perfil.`,
        href: `/profile/${user.id}`,
        metadata: { follower_id: user.id },
      });
    }

    return NextResponse.json({ ok: true, following: true });
  } catch (error) {
    return safeApiError(error, "No se pudo actualizar el seguimiento.", 500);
  }
}
