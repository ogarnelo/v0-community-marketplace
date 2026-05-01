import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ListingGallery from "@/components/marketplace/listing-gallery";
import ShareListingButton from "@/components/marketplace/share-listing-button";
import PostPublishShareCard from "@/components/marketplace/post-publish-share-card";
import RelatedListingsSection from "@/components/marketplace/related-listings-section";
import { BuyNowButton } from "@/components/marketplace/buy-now-button";
import { MakeOfferButton } from "@/components/marketplace/make-offer-button";
import { RequestDonationButton } from "@/components/marketplace/request-donation-button";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildPhotosMap, type ListingPhotoRow, type MarketplaceListing } from "@/lib/types/marketplace";
import { getListingTypeFromRow } from "@/lib/marketplace/listing-type";
import JsonLd from "@/components/seo/json-ld";
import ListingViewTracker from "@/components/analytics/listing-view-tracker";

function formatPrice(value?: number | null) {
  if (typeof value !== "number") return "Consultar";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "available": return "Disponible";
    case "reserved": return "Reservado";
    case "sold": return "Vendido";
    case "archived": return "Archivado";
    default: return status || "Sin estado";
  }
}


export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, description, price, status")
    .eq("id", id)
    .maybeSingle();

  if (!listing) {
    return { title: "Anuncio no encontrado" };
  }

  const title = listing.title || "Anuncio en Wetudy";
  const description = listing.description?.slice(0, 155) || "Anuncio de material educativo en Wetudy.";

  return {
    title,
    description,
    robots: listing.status === "available" ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title,
      description,
      type: "article",
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
    supabase.from("listings").select("id, title, description, category, grade_level, condition, type, listing_type, price, original_price, estimated_retail_price, isbn, seller_id, school_id, status, created_at").eq("id", id).maybeSingle(),
    supabase.from("listing_photos").select("id, listing_id, url, sort_order").eq("listing_id", id).order("sort_order", { ascending: true }),
    authSupabase.auth.getUser(),
  ]);

  if (listingError || !listing) notFound();

  const currentUserId = authData?.user?.id || null;
  const isOwnListing = !!currentUserId && listing.seller_id === currentUserId;
  const isDonation = getListingTypeFromRow(listing as any) === "donation";
  const isAvailable = listing.status === "available";

  const [{ data: seller }, { data: viewerProfile }, { data: reviews }, { data: activeListings }, { data: favorite }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, business_name, user_type, is_business_verified").eq("id", listing.seller_id).maybeSingle(),
    currentUserId ? supabase.from("profiles").select("school_id").eq("id", currentUserId).maybeSingle() : Promise.resolve({ data: null }),
    listing.seller_id ? supabase.from("reviews").select("rating").eq("reviewed_user_id", listing.seller_id) : Promise.resolve({ data: [] }),
    listing.seller_id ? supabase.from("listings").select("id").eq("seller_id", listing.seller_id).eq("status", "available") : Promise.resolve({ data: [] }),
    currentUserId ? supabase.from("favorites").select("listing_id").eq("user_id", currentUserId).eq("listing_id", listing.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const reviewCount = reviews?.length || 0;
  const averageRating = reviewCount > 0 ? (reviews || []).reduce((sum: number, row: any) => sum + Number(row.rating || 0), 0) / reviewCount : null;
  const sellerActiveListings = activeListings?.length || 0;

  const photos = (photosData || []).map((item: { url: string }) => item.url).filter(Boolean);
  const displayTitle = listing.title || "Anuncio";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const shareUrl = appUrl ? `${appUrl}/marketplace/listing/${listing.id}` : `/marketplace/listing/${listing.id}`;
  const currentSchoolId = viewerProfile?.school_id || "";

  const savings = typeof listing.original_price === "number" && typeof listing.price === "number" ? Math.max(0, listing.original_price - listing.price) : 0;

  const relatedQuery = supabase.from("listings").select("id, title, description, category, grade_level, condition, type, listing_type, isbn, price, original_price, estimated_retail_price, seller_id, school_id, status, created_at").eq("status", "available").neq("id", listing.id).limit(8);
  if (listing.isbn) relatedQuery.eq("isbn", listing.isbn);
  else if (listing.category && listing.grade_level) relatedQuery.eq("category", listing.category).eq("grade_level", listing.grade_level);
  else if (listing.category) relatedQuery.eq("category", listing.category);
  else if (listing.grade_level) relatedQuery.eq("grade_level", listing.grade_level);

  const { data: relatedRows } = await relatedQuery;
  const relatedIds = (relatedRows || []).map((item: any) => item.id);
  let relatedPhotosMap = new Map<string, string[]>();
  if (relatedIds.length > 0) {
    const { data: relatedPhotos } = await supabase.from("listing_photos").select("id, listing_id, url, sort_order").in("listing_id", relatedIds).order("sort_order", { ascending: true });
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

  const appUrlForJsonLd = process.env.NEXT_PUBLIC_APP_URL || "https://wetudy.com";
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: displayTitle,
    description: listing.description || "Material educativo en Wetudy",
    sku: listing.isbn || listing.id,
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: listing.price || 0,
      availability: isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${appUrlForJsonLd}/marketplace/listing/${listing.id}`,
    },
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={productJsonLd} />
      <ListingViewTracker listingId={listing.id} sellerId={listing.seller_id} category={listing.category} gradeLevel={listing.grade_level} />
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/marketplace" className="hover:underline">Marketplace</Link>
        <span>/</span>
        <span className="truncate">{displayTitle}</span>
      </div>

      {query.published === "1" && isOwnListing ? <div className="mb-6"><PostPublishShareCard title={displayTitle} url={shareUrl} /></div> : null}

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <ListingGallery photos={photos} title={displayTitle} />
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant={isAvailable ? "default" : "outline"}>{statusLabel(listing.status)}</Badge>
              {isDonation ? <Badge className="bg-emerald-600">Donación</Badge> : null}
              {listing.category ? <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{listing.category}</span> : null}
              {listing.grade_level ? <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{listing.grade_level}</span> : null}
              {listing.condition ? <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{listing.condition}</span> : null}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{displayTitle}</h1>
            {listing.description ? <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">{listing.description}</p> : <p className="mt-4 text-sm text-muted-foreground">El vendedor no ha añadido una descripción todavía.</p>}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs font-medium text-muted-foreground">ISBN</p><p className="mt-1 text-sm">{listing.isbn || "No indicado"}</p></div>
              <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs font-medium text-muted-foreground">Estado</p><p className="mt-1 text-sm">{statusLabel(listing.status)}</p></div>
            </div>
          </div>
          <RelatedListingsSection listings={relatedListings} currentSchoolId={currentSchoolId} />
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Precio</p>
              <p className="text-3xl font-bold">{isDonation ? "Donación" : formatPrice(listing.price)}</p>
              {!isDonation && typeof listing.original_price === "number" ? <p className="text-sm text-muted-foreground">Precio original: {formatPrice(listing.original_price)}</p> : null}
              {!isDonation && savings > 0 ? <p className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">Ahorras {formatPrice(savings)}</p> : null}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {isOwnListing ? (
                <Link href={`/marketplace/edit/${listing.id}`}><Button className="w-full" variant="outline">Editar anuncio</Button></Link>
              ) : isAvailable ? (
                isDonation ? <RequestDonationButton listingId={listing.id} /> : <><BuyNowButton listingId={listing.id} currentPrice={listing.price} /><MakeOfferButton listingId={listing.id} currentPrice={listing.price} /></>
              ) : (
                <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">Este anuncio ya no acepta nuevas compras ni ofertas. Las conversaciones existentes siguen disponibles.</div>
              )}
              {!isOwnListing ? <Link href={`/messages?listing=${listing.id}`}><Button className="w-full" variant="secondary">Hablar con el vendedor</Button></Link> : null}
              <div className="flex flex-wrap items-center gap-2">
                {currentUserId && !isOwnListing ? <FavoriteButton listingId={listing.id} initialIsFavorite={!!favorite} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium" showLabel /> : null}
                <ShareListingButton title={displayTitle} url={shareUrl} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Vendedor</h2>
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-medium">{seller?.business_name || seller?.full_name || "Usuario"}</p>
              <p className="text-muted-foreground">{seller?.user_type === "business" ? "Negocio local" : "Miembro de la comunidad"}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {averageRating ? <span className="rounded-full bg-yellow-50 px-2 py-1 font-medium text-yellow-700">⭐ {averageRating.toFixed(1)} · {reviewCount} opiniones</span> : <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">Sin opiniones todavía</span>}
                <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">{sellerActiveListings} anuncios activos</span>
                {seller?.is_business_verified ? <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700">Negocio verificado</span> : null}
              </div>
              {seller?.id ? <Link href={`/profile/${seller.id}`} className="text-primary hover:underline">Ver perfil</Link> : null}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Compra protegida en Wetudy</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>✓ Paga dentro de la plataforma para mantener historial y seguimiento.</li>
              <li>✓ El chat conserva ofertas, contraofertas y acuerdos.</li>
              <li>✓ En envíos, el estado queda visible en actividad y mensajes.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
