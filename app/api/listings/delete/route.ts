import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BLOCKING_PAYMENT_STATUSES = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
  "paid",
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

    const [{ data: payments }, { data: acceptedOffer }, { data: approvedDonation }, { data: conversations }] = await Promise.all([
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

    await Promise.allSettled([
      admin.from("favorites").delete().eq("listing_id", listingId),
      admin.from("listing_photos").delete().eq("listing_id", listingId),
      admin.from("listing_views").delete().eq("listing_id", listingId),
      admin.from("reports").delete().eq("listing_id", listingId),
    ]);

    const { error: deleteError } = await admin.from("listings").delete().eq("id", listingId);

    if (!deleteError) {
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

    return NextResponse.json({ ok: true, mode: "archived", hadHistory: (conversations || []).length > 0 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || error?.details || "No se pudo eliminar el anuncio." },
      { status: 500 }
    );
  }
}
