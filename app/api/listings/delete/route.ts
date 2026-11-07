import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupDeletedListingPhotos } from "@/lib/marketplace/cleanup-deleted-listing-photos";

const BLOCKING_PAYMENT_STATUSES = [
  "draft",
  "requires_payment_method",
  "requires_confirmation",
  "processing",
  "requires_capture",
  "succeeded",
] as const;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    const body = await request.json();
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";

    if (!listingId) {
      return NextResponse.json({ error: "Falta el anuncio." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id, seller_id, status, photos")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError || !listing) {
      return NextResponse.json({ error: "El anuncio no existe." }, { status: 404 });
    }

    if (listing.seller_id !== user.id) {
      return NextResponse.json({ error: "No tienes permisos para eliminar este anuncio." }, { status: 403 });
    }

    const [
      { data: payments, error: paymentsError },
      { data: acceptedOffer, error: offersError },
      { data: approvedDonation, error: donationsError },
      { data: conversations, error: conversationsError },
      { data: reports, error: reportsError },
    ] = await Promise.all([
      admin
        .from("payment_intents")
        .select("id, status")
        .eq("listing_id", listingId)
        .in("status", [...BLOCKING_PAYMENT_STATUSES]),
      admin
        .from("listing_offers")
        .select("id")
        .eq("listing_id", listingId)
        .eq("status", "accepted")
        .maybeSingle(),
      admin
        .from("donation_requests")
        .select("id")
        .eq("listing_id", listingId)
        .eq("status", "approved")
        .maybeSingle(),
      admin
        .from("conversations")
        .select("id")
        .eq("listing_id", listingId)
        .limit(1),
      admin
        .from("reports")
        .select("id")
        .eq("listing_id", listingId)
        .limit(1),
    ]);

    // Never interpret a failed payment, agreement or history lookup as
    // proof that an irreversible deletion is safe.
    if (paymentsError || offersError || donationsError || conversationsError || reportsError) {
      return NextResponse.json(
        { error: "No se pudo comprobar el historial del anuncio. Inténtalo más tarde." },
        { status: 503 }
      );
    }

    if ((payments || []).length > 0 || acceptedOffer || approvedDonation) {
      return NextResponse.json(
        {
          error:
            "Este anuncio ya tiene una operación en curso o cerrada. Para conservar el historial, puedes archivarlo pero no eliminarlo definitivamente.",
        },
        { status: 409 }
      );
    }

    const hasModerationOrConversationHistory =
      (conversations || []).length > 0 || (reports || []).length > 0;

    if (hasModerationOrConversationHistory) {
      const { error: archiveHistoryError } = await admin
        .from("listings")
        .update({ status: "archived" })
        .eq("id", listingId)
        .eq("seller_id", user.id);

      if (archiveHistoryError) {
        return NextResponse.json(
          { error: archiveHistoryError.message || "No se pudo archivar el anuncio." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        mode: "archived",
        hadHistory: true,
      });
    }

    // Collect database-owned URLs before deleting the parent. The existing FK
    // ON DELETE CASCADE removes listing_photos, favorites and listing_views.
    // Physical Storage objects are cleaned separately only after success.
    const { data: photoRows, error: photoQueryError } = await admin
      .from("listing_photos")
      .select("url")
      .eq("listing_id", listingId);
    if (photoQueryError) {
      console.error("No se pudieron recopilar todas las fotos del anuncio", photoQueryError);
    }
    const candidatePhotoUrls = photoQueryError ? [] : [
      ...(Array.isArray(listing.photos) ? listing.photos : []),
      ...(photoRows || []).map((row) => row.url),
    ].filter((url): url is string => typeof url === "string");

    const { data: deletedRow, error: deleteError } = await admin
      .from("listings")
      .delete()
      .eq("id", listingId)
      .eq("seller_id", user.id)
      .select("id")
      .maybeSingle();

    if (!deleteError && !deletedRow) {
      return NextResponse.json(
        { error: "El anuncio ha cambiado. Actualiza la página antes de intentarlo de nuevo." },
        { status: 409 }
      );
    }

    if (!deleteError && deletedRow) {
      if (candidatePhotoUrls.length > 0) {
        await cleanupDeletedListingPhotos(admin, {
          ownerId: user.id,
          listingId,
          urls: candidatePhotoUrls,
        });
      }
      return NextResponse.json({ ok: true, mode: "deleted" });
    }

    const { error: archiveError } = await admin
      .from("listings")
      .update({ status: "archived" })
      .eq("id", listingId)
      .eq("seller_id", user.id);

    if (archiveError) {
      return NextResponse.json(
        { error: deleteError.message || archiveError.message || "No se pudo eliminar el anuncio." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, mode: "archived", hadHistory: false });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || error?.details || "No se pudo eliminar el anuncio." },
      { status: 500 }
    );
  }
}
