import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ListingGallery from "@/components/marketplace/listing-gallery";
import ShareListingButton from "@/components/marketplace/share-listing-button";
import PostPublishShareCard from "@/components/marketplace/post-publish-share-card";
import RelatedListingsSection from "@/components/marketplace/related-listings-section";
import { ContactSellerButton } from "@/components/messages/contact-seller-button";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { DeleteListingButton } from "@/components/account/delete-listing-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildPhotosMap, type ListingPhotoRow, type MarketplaceListing } from "@/lib/types/marketplace";
import { getListingTypeFromRow } from "@/lib/marketplace/listing-type";
import { getConditionLabel } from "@/lib/marketplace/formatters";
import JsonLd from "@/components/seo/json-ld";
import ListingViewTracker from "@/components/analytics/listing-view-tracker";
import MobileListingActions from "@/components/marketplace/mobile-listing-actions";
import { SEO_SITE_URL, buildBreadcrumbJsonLd } from "@/lib/seo/structured-data";

function formatPrice(value?: number | null) {
  if (typeof value !== "number") return "Consultar";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "available": return "Disponible";
    case "reserved": return "Reservado";
    case "sold": return "Vendido";
    case "donated": return "Donado";
    case "archived": return "Archivado";
    default: return status || "Sin estado";
  }
}

function shouldShowIsbn(category?: string | null, isbn?: string | null) {
  if (!isbn) return false;
  const normalized = (category || "").toLowerCase();
  return normalized.includes("libro") || normalized.includes("lectura");
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: listing }, { data: photo }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, title, description, category, grade_level, price, status, type, listing_type")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("listing_photos")
      .select("url")
      .eq("listing_id", id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!listing || listing.status !== "available") {
    return {
      title: "Anuncio no disponible | Wetudy",
      description: "Este anuncio ya no está disponible públicamente.",
      robots: { index: false, follow: false },
    };
  }

  const title = listing.title || "Material escolar en Wetudy";
  const contextParts = [listing.category, listing.grade_level].filter(Boolean).join(" · ");
  const fallbackDescription = contextParts
    ? `${contextParts}. Material escolar de segunda mano publicado en Wetudy.`
    : "Material escolar de segunda mano publicado en Wetudy.";
  const description = listing.description?.trim().slice(0, 155) || fallbackDescription;
  const canonical = `${SEO_SITE_URL}/marketplace/listing/${listing.id}`;
  const image = photo?.url || undefined;

  return {
    title,
    description,
    alternates: { canonical },
    robots: listing.status === "available"
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: image ? [{ url: image, alt: title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();
  const authSupabase = await createClient();

  const [{ data: listing, error: listingError }, { data: photosData }, { data: authData }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, title, description, category, grade_level, condition, type, listing_type, price, original_price, estimated_retail_price, isbn, seller_id, school_id, status, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("listing_photos")
      .select("id, listing_id, url, sort_order")
      .eq("listing_id", id)
      .order("sort_order", { ascending: true }),
    authSupabase.auth.getUser(),
  ]);

  if (listingError || !listing) notFound();

  const currentUserId = authData?.user?.id || null;
  const isOwnListing = !!currentUserId && listing.seller_id === currentUserId;
  const isDonation = getListingTypeFromRow(listing as any) === "donation";
  const isAvailable = listing.status === "available";

  if (!isAvailable && !isOwnListing) {
    if (!currentUserId) notFound();

    const { data: participantConversation } = await authSupabase
      .from("conversations")
      .select("id")
      .eq("listing_id", listing.id)
      .or(`buyer_id.eq.${currentUserId},seller_id.eq.${currentUserId}`)
      .limit(1)
      .maybeSingle();

    if (!participantConversation) notFound();
  }
  const conditionText = getConditionLabel(listing.condition);
  const showIsbn = shouldShowIsbn(listing.category, listing.isbn);

  const [{ data: seller }, { data: viewerProfile }, { data: reviews }, { data: activeListings }, { data: favorite }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, business_name, user_type, is_business_verified").eq("id", listing.seller_id).maybeSingle(),
    currentUserId ? supabase.from("profiles").select("school_id").eq("id", currentUserId).maybeSingle() : Promise.resolve({ data: null }),
    listing.seller_id ? supabase.from("transaction_reviews").select("rating").eq("reviewed_user_id", listing.seller_id) : Promise.resolve({ data: [] }),
    listing.seller_id ? supabase.from("listings").select("id").eq("seller_id", listing.seller_id).eq("status", "available") : Promise.resolve({ data: [] }),
    currentUserId ? supabase.from("favorites").select("listing_id").eq("user_id", currentUserId).eq("listing_id", listing.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const reviewCount = reviews?.length || 0;
  const averageRating = reviewCount > 0 ? (reviews || []).reduce((sum: number, row: any) => sum + Number(row.rating || 0), 0) / reviewCount : null;
  const sellerActiveListings = activeListings?.length || 0;
  const isProfessionalSeller = seller?.user_type === "business" || Boolean(seller?.is_business_verified);

  const photos = (photosData || []).map((item: { url: string }) => item.url).filter(Boolean);
  const displayTitle = listing.title || "Anuncio";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const shareUrl = appUrl ? `${appUrl}/marketplace/listing/${listing.id}` : `/marketplace/listing/${listing.id}`;
  const currentSchoolId = viewerProfile?.school_id || "";
  const savings = typeof listing.original_price === "number" && typeof listing.price === "number" ? Math.max(0, listing.original_price - listing.price) : 0;
  const sellerName = seller?.business_name || seller?.full_name || "Usuario de Wetudy";
  const createdAtLabel = listing.created_at
    ? new Date(listing.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  const relatedQuery = supabase
    .from("listings")
    .select("id, title, description, category, grade_level, condition, type, listing_type, isbn, price, original_price, estimated_retail_price, seller_id, school_id, status, created_at")
    .eq("status", "available")
    .neq("id", listing.id)
    .limit(6);

  if (listing.isbn) relatedQuery.eq("isbn", listing.isbn);
  else if (listing.category && listing.grade_level) relatedQuery.eq("category", listing.category).eq("grade_level", listing.grade_level);
  else if (listing.category) relatedQuery.eq("category", listing.category);
  else if (listing.grade_level) relatedQuery.eq("grade_level", listing.grade_level);

  const { data: relatedRows } = await relatedQuery;
  const relatedIds = (relatedRows || []).map((item: any) => item.id);
  let relatedPhotosMap = new Map<string, string[]>();
  if (relatedIds.length > 0) {
    const { data: relatedPhotos } = await supabase
      .from("listing_photos")
      .select("id, listing_id, url, sort_order")
      .in("listing_id", relatedIds)
      .order("sort_order", { ascending: true });
    relatedPhotosMap = buildPhotosMap((relatedPhotos || []) as ListingPhotoRow[]);
  }

  const relatedListings: MarketplaceListing[] = (relatedRows || []).map((item: any) => ({
    id: item.id,
    title: item.title || "Anuncio sin título",
    description: item.description || null,
    category: item.category,
    gradeLevel: item.grade_level,
    condition: item.condition,
    type: item.type || item.listing_type,
    isbn: item.isbn || null,
    price: item.price ?? undefined,
    originalPrice: item.original_price ?? item.estimated_retail_price ?? undefined,
    photos: relatedPhotosMap.get(item.id) || [],
    sellerId: item.seller_id || null,
    schoolId: item.school_id || null,
    status: item.status,
    createdAt: item.created_at || null,
    isFavorite: false,
  }));

  const canonicalUrl = `${SEO_SITE_URL}/marketplace/listing/${listing.id}`;
  const normalizedCondition = String(listing.condition || "").toLowerCase();
  const schemaCondition = normalizedCondition.includes("new") || normalizedCondition.includes("nuevo")
    ? "https://schema.org/NewCondition"
    : "https://schema.org/UsedCondition";
  const hasExplicitPrice = typeof listing.price === "number" && Number.isFinite(listing.price);
  const offerJsonLd = isDonation || hasExplicitPrice
    ? {
        "@type": "Offer",
        priceCurrency: "EUR",
        price: isDonation ? 0 : listing.price,
        availability: isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: canonicalUrl,
      }
    : undefined;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: displayTitle,
    description: listing.description || "Material escolar de segunda mano en Wetudy",
    sku: listing.isbn || listing.id,
    category: listing.category || undefined,
    image: photos.length > 0 ? photos : undefined,
    itemCondition: schemaCondition,
    offers: offerJsonLd,
  };

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Wetudy", path: "/" },
    { name: "Material escolar", path: "/marketplace" },
    { name: displayTitle, url: canonicalUrl },
  ]);

  return (
    <div className="bg-slate-50/60 pb-28 md:pb-10">
      <JsonLd data={[productJsonLd, breadcrumbJsonLd]} />
      <ListingViewTracker listingId={listing.id} sellerId={listing.seller_id} category={listing.category} gradeLevel={listing.grade_level} />

      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Link href="/marketplace" className="font-medium text-foreground hover:text-primary">Marketplace</Link>
            <span>/</span>
            <span className="truncate">{displayTitle}</span>
          </div>
          <Link href="/marketplace" className="text-sm font-medium text-primary hover:underline">Volver al marketplace</Link>
        </div>

        {query.published === "1" && isOwnListing ? <div className="mb-6"><PostPublishShareCard title={displayTitle} url={shareUrl} /></div> : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_380px]">
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[1.75rem] border bg-white shadow-sm">
              <ListingGallery photos={photos} title={displayTitle} />
            </div>

            <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isAvailable ? "default" : "outline"}>{statusLabel(listing.status)}</Badge>
                {isDonation ? <Badge className="bg-emerald-600">Donación</Badge> : null}
                {listing.category ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{listing.category}</span> : null}
                {listing.grade_level ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{listing.grade_level}</span> : null}
                {listing.condition ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{conditionText}</span> : null}
              </div>

              <div className="mt-5">
                <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{displayTitle}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {createdAtLabel ? `Publicado el ${createdAtLabel}` : "Publicado en Wetudy"} · {sellerName}
                </p>
              </div>

              <div className="mt-6 border-t pt-6">
                <h2 className="text-lg font-semibold text-slate-950">Descripción</h2>
                {listing.description ? (
                  <p className="mt-3 whitespace-pre-line text-base leading-7 text-slate-700">{listing.description}</p>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">El vendedor no ha añadido una descripción todavía.</p>
                )}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado del material</p>
                  <p className="mt-1 text-sm font-medium text-slate-950">{conditionText}</p>
                </div>
                {showIsbn ? (
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ISBN</p>
                    <p className="mt-1 text-sm font-medium text-slate-950">{listing.isbn}</p>
                  </div>
                ) : null}
              </div>
            </section>

            <RelatedListingsSection listings={relatedListings} currentSchoolId={currentSchoolId} />
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
              <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumen</p>
                <p className="mt-1 text-3xl font-bold text-slate-950">{isDonation ? "Donación" : formatPrice(listing.price)}</p>
                {!isDonation && typeof listing.original_price === "number" ? <p className="mt-1 text-sm text-muted-foreground">Precio original: {formatPrice(listing.original_price)}</p> : null}
                {!isDonation && savings > 0 ? <p className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-sm font-medium text-emerald-700 shadow-sm">Ahorras {formatPrice(savings)}</p> : null}
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
                  <span className="text-muted-foreground">Foto real</span>
                  <span className="font-medium text-emerald-700">Obligatoria</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
                  <span className="text-muted-foreground">Contacto</span>
                  <span className="font-medium text-slate-950">Chat Wetudy</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
                  <span className="text-muted-foreground">Acuerdo</span>
                  <span className="font-medium text-slate-950">Entre partes</span>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                {isOwnListing ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link href={`/marketplace/edit/${listing.id}`}><Button className="w-full" variant="outline">Editar anuncio</Button></Link>
                    <DeleteListingButton
                      listingId={listing.id}
                      title={listing.title}
                      redirectTo="/account/listings"
                      className="w-full justify-center"
                    />
                  </div>
                ) : isAvailable && listing.seller_id ? (
                  <>
                    <ContactSellerButton listingId={listing.id} sellerId={listing.seller_id} />
                    <p className="rounded-2xl border bg-slate-50 p-3 text-xs leading-5 text-muted-foreground">
                      Wetudy facilita el contacto y conserva el historial. La entrega y el pago se acuerdan directamente entre las partes.
                      {isProfessionalSeller ? " En perfiles profesionales el precio es fijo; usa el chat para resolver dudas." : " Si el vendedor acepta negociar, cerradlo por chat antes de confirmar el acuerdo."}
                    </p>
                  </>
                ) : (
                  <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-muted-foreground">Este anuncio ya no acepta nuevos contactos. Las conversaciones existentes siguen disponibles.</div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {currentUserId && !isOwnListing ? <FavoriteButton listingId={listing.id} initialIsFavorite={!!favorite} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium" showLabel /> : null}
                  <ShareListingButton title={displayTitle} url={shareUrl} />
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                  {sellerName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-950">{sellerName}</h2>
                  <p className="text-sm text-muted-foreground">{seller?.user_type === "business" ? "Negocio local" : "Miembro de la comunidad"}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {averageRating ? <span className="rounded-full bg-yellow-50 px-2 py-1 font-medium text-yellow-700">⭐ {averageRating.toFixed(1)} · {reviewCount} opiniones</span> : <span className="rounded-full bg-slate-100 px-2 py-1 text-muted-foreground">Sin opiniones todavía</span>}
                <span className="rounded-full bg-slate-100 px-2 py-1 text-muted-foreground">{sellerActiveListings} anuncios activos</span>
                {seller?.is_business_verified ? <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700">Negocio verificado</span> : null}
              </div>
              {seller?.id ? <Link href={`/profile/${seller.id}`} className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">Ver perfil del vendedor</Link> : null}
            </section>

            <section className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Cómo funciona</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">1</span><p>Contacta con la otra persona por chat.</p></div>
                <div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">2</span><p>Acordad precio final, entrega y detalles.</p></div>
                <div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">3</span><p>Confirmad el acuerdo para dejar historial y poder valorar.</p></div>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <MobileListingActions
        listingId={listing.id}
        price={listing.price}
        isDonation={isDonation}
        isAvailable={isAvailable}
        isOwnListing={isOwnListing}
        sellerId={listing.seller_id}
      />
    </div>
  );
}
