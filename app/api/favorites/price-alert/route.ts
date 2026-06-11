import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotifications } from "@/lib/notifications";
import { sendPriceDropEmail } from "@/lib/emails/alerts";
import { safeApiError } from "@/lib/api/safe-error";

const PRICE_ALERT_COOLDOWN_HOURS = 24;
const MAX_PRICE_ALERT_RECIPIENTS = 200;
const MAX_PRICE_ALERT_EMAILS = 100;

function parseMoney(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

function cooldownSince() {
  return new Date(Date.now() - PRICE_ALERT_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
}

async function hasRecentPriceAlert(adminSupabase: ReturnType<typeof createAdminClient>, listingId: string) {
  try {
    const { data } = await adminSupabase
      .from("notifications")
      .select("id")
      .eq("kind", "price_drop")
      .contains("metadata", { listing_id: listingId })
      .gte("created_at", cooldownSince())
      .limit(1);

    return Boolean(data?.length);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const listingId = String(body?.listingId || "").trim();
    const oldPrice = parseMoney(body?.oldPrice);
    const newPrice = parseMoney(body?.newPrice);

    if (!listingId) {
      return NextResponse.json({ error: "Missing listing id" }, { status: 400 });
    }

    if (oldPrice === null || newPrice === null) {
      return NextResponse.json({ error: "Faltan oldPrice y newPrice." }, { status: 400 });
    }

    if (newPrice >= oldPrice) {
      return NextResponse.json({ ok: true, skipped: true, reason: "not_a_price_drop" });
    }

    const { data: listing } = await adminSupabase
      .from("listings")
      .select("id, title, seller_id, price")
      .eq("id", listingId)
      .maybeSingle();

    if (!listing || listing.seller_id !== user.id) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const currentPrice = parseMoney(listing.price);
    if (currentPrice !== null && Math.abs(currentPrice - newPrice) > 0.01) {
      return NextResponse.json({ ok: true, skipped: true, reason: "listing_price_mismatch" });
    }

    if (await hasRecentPriceAlert(adminSupabase, listingId)) {
      return NextResponse.json({ ok: true, skipped: true, reason: "cooldown" });
    }

    const { data: favorites } = await adminSupabase
      .from("favorites")
      .select("user_id")
      .eq("listing_id", listingId)
      .limit(MAX_PRICE_ALERT_RECIPIENTS);

    const favoriteUserIds = Array.from(
      new Set((favorites || []).map((fav: { user_id: string }) => fav.user_id).filter(Boolean))
    ).filter((targetUserId) => targetUserId !== user.id);

    await createNotifications(
      adminSupabase,
      favoriteUserIds.map((userId: string) => ({
        user_id: userId,
        kind: "price_drop",
        title: "Ha bajado el precio de un favorito",
        body: `El anuncio "${listing.title || "Anuncio"}" ha bajado de ${oldPrice.toFixed(2)} € a ${newPrice.toFixed(2)} €.` ,
        href: `/marketplace/listing/${listing.id}`,
        metadata: { listing_id: listing.id, old_price: oldPrice, new_price: newPrice },
      }))
    );

    const emailTargets = favoriteUserIds.slice(0, MAX_PRICE_ALERT_EMAILS);
    await Promise.allSettled(
      emailTargets.map(async (userId: string) => {
        const { data: authUser } = await adminSupabase.auth.admin.getUserById(userId);
        const email = authUser?.user?.email;
        if (!email) return;
        await sendPriceDropEmail({ to: email, listingTitle: listing.title || "Anuncio", listingId: listing.id });
      })
    );

    return NextResponse.json({ ok: true, sent: favoriteUserIds.length, emailed: emailTargets.length });
  } catch (error) {
    return safeApiError(error, "No se pudo enviar la alerta de precio.", 500);
  }
}
