import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cloneTitle } from "@/lib/inventory/expansion";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
  const titleOverride = typeof body?.title === "string" ? body.title.trim() : "";

  if (!listingId) {
    return NextResponse.json({ error: "Falta el anuncio original." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("id, title, description, category, grade_level, condition, type, listing_type, isbn, price, original_price, seller_id, school_id, status")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError || !listing) {
    return NextResponse.json({ error: "El anuncio original no existe." }, { status: 404 });
  }

  if (listing.seller_id !== user.id) {
    return NextResponse.json({ error: "No puedes duplicar un anuncio que no es tuyo." }, { status: 403 });
  }

  const { data: photos, error: photosError } = await admin
    .from("listing_photos")
    .select("url, sort_order")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true });

  if (photosError) {
    return NextResponse.json({ error: "No se pudieron leer las fotos del anuncio." }, { status: 500 });
  }

  if (!photos || photos.length === 0) {
    return NextResponse.json(
      { error: "Para duplicar un anuncio necesitas que el anuncio original tenga al menos una foto." },
      { status: 400 }
    );
  }

  const { data: inserted, error: insertError } = await admin
    .from("listings")
    .insert({
      title: titleOverride || cloneTitle(listing.title || "Anuncio"),
      description: listing.description,
      category: listing.category,
      grade_level: listing.grade_level,
      condition: listing.condition,
      type: listing.type || listing.listing_type || "sale",
      listing_type: listing.listing_type || listing.type || "sale",
      isbn: listing.isbn,
      price: listing.price,
      original_price: listing.original_price,
      seller_id: user.id,
      school_id: listing.school_id || null,
      status: "available",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message || "No se pudo duplicar el anuncio." }, { status: 500 });
  }

  const copiedPhotos = photos.slice(0, 5).map((photo: any, index: number) => ({
    listing_id: inserted.id,
    url: photo.url,
    sort_order: typeof photo.sort_order === "number" ? photo.sort_order : index,
  }));

  const { error: photoInsertError } = await admin.from("listing_photos").insert(copiedPhotos);

  if (photoInsertError) {
    await admin.from("listings").delete().eq("id", inserted.id);
    return NextResponse.json({ error: "No se pudieron copiar las fotos." }, { status: 500 });
  }

  await admin.from("inventory_expansion_events").insert({
    user_id: user.id,
    source_listing_id: listingId,
    target_listing_id: inserted.id,
    event_type: "duplicate_created",
    metadata: {
      photo_count: copiedPhotos.length,
    },
  });

  return NextResponse.json({ ok: true, listingId: inserted.id });
}
