import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
      .select("id, seller_id, status")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError || !listing) {
      return NextResponse.json({ error: "El anuncio no existe." }, { status: 404 });
    }

    if (listing.seller_id !== user.id) {
      return NextResponse.json({ error: "No tienes permisos para eliminar este anuncio." }, { status: 403 });
    }

    // All queries must succeed before any destructive write. A failed history
    // lookup must NEVER be interpreted as "there is no history".
    const [
      paymentsResult,
      acceptedOfferResult,
      approvedDonationResult,
      conversationsResult,
      reportsResult,
      offersResult,
      donationsResult,
      agreementsResult,
      shipmentsResult,
      reviewsResult,
      transactionIssuesResult,
      boostsResult,
    ] = await Promise.all([
      // An expired, refunded or cancelled payment is still accounting history.
      admin.from("payment_intents").select("id").eq("listing_id", listingId).limit(1),
      admin.from("listing_offers").select("id").eq("listing_id", listingId)
        .eq("status", "accepted").limit(1),
      admin.from("donation_requests").select("id").eq("listing_id", listingId)
        .eq("status", "approved").limit(1),
      admin.from("conversations").select("id").eq("listing_id", listingId).limit(1),
      admin.from("reports").select("id").eq("listing_id", listingId).limit(1),
      admin.from("listing_offers").select("id").eq("listing_id", listingId).limit(1),
      admin.from("donation_requests").select("id").eq("listing_id", listingId).limit(1),
      admin.from("agreements").select("id").eq("listing_id", listingId).limit(1),
      admin.from("shipments").select("id").eq("listing_id", listingId).limit(1),
      admin.from("reviews").select("id").eq("listing_id", listingId).limit(1),
      admin.from("transaction_issues").select("id").eq("listing_id", listingId).limit(1),
      admin.from("listing_boosts").select("id").eq("listing_id", listingId).limit(1),
    ]);

    const lookups = [
      paymentsResult, acceptedOfferResult, approvedDonationResult,
      conversationsResult, reportsResult, offersResult, donationsResult,
      agreementsResult, shipmentsResult, reviewsResult,
      transactionIssuesResult, boostsResult,
    ];
    if (lookups.some((result) => result.error)) {
      return NextResponse.json(
        { error: "No se pudo verificar el historial del anuncio. Inténtalo más tarde." },
        { status: 503 }
      );
    }
    const anyRows = (result: { data: { id: string }[] | null }) =>
      (result.data?.length || 0) > 0;

    // Never erase financial or completed transaction history regardless of
    // provider status. The owner can archive the listing instead.
    if (
      anyRows(paymentsResult) ||
      anyRows(acceptedOfferResult) ||
      anyRows(approvedDonationResult)
    ) {
      return NextResponse.json(
        {
          error:
            "Este anuncio tiene historial de pagos o una operación confirmada. Para conservarlo, puedes archivarlo pero no eliminarlo definitivamente.",
        },
        { status: 409 }
      );
    }

    const hasModerationOrConversationHistory = [
      conversationsResult, reportsResult, offersResult, donationsResult,
      agreementsResult, shipmentsResult, reviewsResult,
      transactionIssuesResult, boostsResult,
    ].some(anyRows);

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

    // Delete the parent FIRST. PostgreSQL enforces referential integrity:
    // relations with ON DELETE CASCADE are removed atomically, while a
    // restrictive relation aborts the DELETE without discarding photos,
    // favorites or views. Never delete those children before knowing the
    // parent can be removed; archiving must preserve them if DELETE fails.
    const { data: deletedRows, error: deleteError } = await admin
      .from("listings")
      .delete()
      .eq("id", listingId)
      .eq("seller_id", user.id)
      .select("id");

    if (!deleteError && deletedRows?.length === 1) {
      return NextResponse.json({ ok: true, mode: "deleted" });
    }
    if (!deleteError) {
      return NextResponse.json(
        { error: "El anuncio ya no está disponible para eliminar." },
        { status: 409 }
      );
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
