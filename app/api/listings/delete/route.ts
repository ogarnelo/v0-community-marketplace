import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupDeletedListingPhotos } from "@/lib/marketplace/cleanup-deleted-listing-photos";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BLOCKING_PAYMENT_STATUSES = [
  "draft", "requires_payment_method", "requires_confirmation",
  "processing", "requires_capture", "succeeded",
] as const;

// The FK audit confirms these tables can retain payment, human interaction,
// moderation or delivery history. A listing with any such row is archived,
// never hard-deleted with ON DELETE CASCADE.
const RETAIN_HISTORY_TABLES = [
  "payment_intents",
  "listing_offers",
  "donation_requests",
  "conversations",
  "reports",
  "agreements",
  "shipments",
  "reviews",
  "moderation_flags",
  "transaction_issues",
  "listing_boosts",
] as const;

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) return privateJson({ error: "No se pudo comprobar tu sesión." }, 503);
    if (!user) return privateJson({ error: "Debes iniciar sesión." }, 401);

    const body = await request.json().catch(() => null);
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    if (!UUID_RE.test(listingId)) {
      return privateJson({ error: "Identificador de anuncio no válido." }, 400);
    }

    const admin = createAdminClient();
    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id,seller_id,status,photos")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError) return privateJson({ error: "No se pudo consultar el anuncio." }, 503);
    if (!listing) return privateJson({ error: "El anuncio no existe." }, 404);
    if (listing.seller_id !== user.id) {
      return privateJson({ error: "No tienes permisos para eliminar este anuncio." }, 403);
    }

    const [paymentBlockers, acceptedOffers, approvedDonations, ...history] = await Promise.all([
      admin.from("payment_intents").select("id")
        .eq("listing_id", listingId).in("status", [...BLOCKING_PAYMENT_STATUSES]).limit(1),
      admin.from("listing_offers").select("id")
        .eq("listing_id", listingId).eq("status", "accepted").limit(1),
      admin.from("donation_requests").select("id")
        .eq("listing_id", listingId).eq("status", "approved").limit(1),
      ...RETAIN_HISTORY_TABLES.map(table =>
        admin.from(table).select("id").eq("listing_id", listingId).limit(1)
      ),
    ]);

    // Never mistake a provider/RLS error for an empty result. One failed
    // preflight means no update, delete, child cleanup, or storage mutation.
    const preflight = [paymentBlockers, acceptedOffers, approvedDonations, ...history];
    if (preflight.some(result => result.error)) {
      console.error("listing_delete_history_preflight_failed");
      return privateJson({ error: "No se pudo comprobar el historial del anuncio." }, 503);
    }

    if (paymentBlockers.data?.length || acceptedOffers.data?.length || approvedDonations.data?.length) {
      return privateJson({
        error: "Este anuncio ya tiene una operación en curso o cerrada. Para conservar el historial, puedes archivarlo pero no eliminarlo definitivamente.",
      }, 409);
    }

    if (history.some(result => (result.data?.length || 0) > 0)) {
      const { data: archived, error: archiveError } = await admin
        .from("listings")
        .update({ status: "archived" })
        .eq("id", listingId)
        .eq("seller_id", user.id)
        .select("id")
        .maybeSingle();
      if (archiveError || !archived) {
        return privateJson({ error: "No se pudo archivar el anuncio." }, 503);
      }
      return privateJson({ ok: true, mode: "archived", hadHistory: true });
    }

    // Collect only server-owned listing photo URLs before the FK cascade.
    // A failed read is not permission to delete and lose references: fail
    // before touching the listing or Storage, with no client-controlled paths.
    const { data: photoRows, error: photoReadError } = await admin
      .from("listing_photos")
      .select("url")
      .eq("listing_id", listingId);
    if (photoReadError) {
      console.error("listing_photo_cleanup_preflight_failed");
      return privateJson({ error: "No se pudo comprobar el historial fotográfico." }, 503);
    }
    const photoUrls = [...new Set([
      ...(Array.isArray(listing.photos) ? listing.photos : []),
      ...(photoRows || []).map(row => row.url),
    ].filter((url): url is string => typeof url === "string"))];

    // The audited FK constraints use ON DELETE CASCADE / SET NULL for
    // dependent records. Do not delete listing_photos, favorites or views
    // before the listing delete is confirmed: a failed delete would
    // otherwise irreversibly strip a still-existing listing of its photos.
    const { data: deleted, error: deleteError } = await admin
      .from("listings")
      .delete()
      .eq("id", listingId)
      .eq("seller_id", user.id)
      .select("id")
      .maybeSingle();

    if (deleteError || !deleted) {
      console.error("listing_delete_not_confirmed");
      return privateJson({ error: "No se pudo eliminar el anuncio." }, 503);
    }
    // Never call Storage before a verified DELETE or after an archive.
    // Cleanup is best effort, scoped to this seller/listing and only
    // when the object has no remaining references across persisted tables.
    if (photoUrls.length > 0) {
      await cleanupDeletedListingPhotos(admin, {
        ownerId: user.id, listingId, urls: photoUrls,
      });
    }
    return privateJson({ ok: true, mode: "deleted" });
  } catch {
    console.error("listing_delete_unexpected_failure");
    return privateJson({ error: "No se pudo eliminar el anuncio." }, 500);
  }
}
