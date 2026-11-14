import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
      .select("id, seller_id, status")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError || !listing) {
      return NextResponse.json({ error: "El anuncio no existe." }, { status: 404 });
    }

    if (listing.seller_id !== user.id) {
      return NextResponse.json({ error: "No tienes permisos para eliminar este anuncio." }, { status: 403 });
    }

    const [
      { data: payments },
      { data: acceptedOffer },
      { data: approvedDonation },
      { data: conversations },
      { data: reports },
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
