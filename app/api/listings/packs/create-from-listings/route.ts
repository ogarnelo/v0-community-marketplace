import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  packDescriptionFromListings,
  packTitleFromListings,
  suggestedPackPrice,
} from "@/lib/inventory/expansion";

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
  const listingIds = Array.isArray(body?.listingIds)
    ? body.listingIds.filter((id: unknown) => typeof id === "string").slice(0, 12)
    : [];

  const titleOverride = typeof body?.title === "string" ? body.title.trim() : "";
  const priceOverride = body?.price !== undefined && body?.price !== null ? Number(body.price) : null;

  if (listingIds.length < 2) {
    return NextResponse.json({ error: "Selecciona al menos 2 anuncios para crear un pack." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: listings, error: listingsError } = await admin
    .from("listings")
    .select("id, title, description, category, grade_level, condition, type, listing_type, isbn, price, original_price, seller_id, school_id, status")
    .in("id", listingIds);

  if (listingsError || !listings) {
    return NextResponse.json({ error: "No se pudieron leer los anuncios." }, { status: 500 });
  }

  if (listings.length !== listingIds.length || listings.some((listing: any) => listing.seller_id !== user.id)) {
    return NextResponse.json({ error: "Solo puedes crear packs con tus propios anuncios." }, { status: 403 });
  }

  const { data: photos } = await admin
    .from("listing_photos")
    .select("listing_id, url, sort_order")
    .in("listing_id", listingIds)
    .order("sort_order", { ascending: true });

  const photoRows = photos || [];
  const coveredListingIds = new Set(photoRows.map((photo: any) => photo.listing_id));

  if (coveredListingIds.size < listingIds.length) {
    return NextResponse.json(
      { error: "Todos los anuncios seleccionados deben tener al menos una foto para crear un pack fiable." },
      { status: 400 }
    );
  }

  const totalOriginal = listings.reduce((sum: number, listing: any) => {
    const price = Number(listing.price || 0);
    return Number.isFinite(price) ? sum + price : sum;
  }, 0);

  const suggestedPrice = suggestedPackPrice(listings as any);
  const finalPrice = Number.isFinite(priceOverride as number) && (priceOverride as number) >= 0
    ? priceOverride
    : suggestedPrice;

  const first = listings[0] as any;

  const { data: inserted, error: insertError } = await admin
    .from("listings")
    .insert({
      title: titleOverride || packTitleFromListings(listings as any),
      description: packDescriptionFromListings(listings as any),
      category: first.category,
      grade_level: first.grade_level,
      condition: "good",
      type: "sale",
      listing_type: "sale",
      isbn: null,
      price: finalPrice,
      original_price: totalOriginal || null,
      seller_id: user.id,
      school_id: first.school_id || null,
      status: "available",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message || "No se pudo crear el pack." }, { status: 500 });
  }

  const copiedPhotos = photoRows
    .filter((photo: any, index: number, array: any[]) => array.findIndex((p: any) => p.listing_id === photo.listing_id) === index)
    .slice(0, 5)
    .map((photo: any, index: number) => ({
      listing_id: inserted.id,
      url: photo.url,
      sort_order: index,
    }));

  const { error: photoError } = await admin.from("listing_photos").insert(copiedPhotos);

  if (photoError) {
    await admin.from("listings").delete().eq("id", inserted.id);
    return NextResponse.json({ error: "No se pudieron copiar fotos al pack." }, { status: 500 });
  }

  await admin.from("inventory_expansion_events").insert({
    user_id: user.id,
    target_listing_id: inserted.id,
    event_type: "pack_created",
    metadata: {
      source_listing_ids: listingIds,
      photo_count: copiedPhotos.length,
      suggested_price: suggestedPrice,
      total_original: totalOriginal,
    },
  });

  return NextResponse.json({ ok: true, listingId: inserted.id });
}
