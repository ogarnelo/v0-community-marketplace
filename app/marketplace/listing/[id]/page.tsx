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
import ListingStatusCard from "@/components/marketplace/listing-status-card";
import SellerTrustCard from "@/components/marketplace/seller-trust-card";
import ReportListingButton from "@/components/marketplace/report-listing-button";
import ListingViewTracker from "@/components/marketplace/listing-view-tracker";

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

  const [{ data: seller }, { data: viewerProfile }, { data: transactionReviews }, { data: legacyReviews }, { data: activeListings }, { data: favorite }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, business_name, user_type, is_business_verified").eq("id", listing.seller_id).maybeSingle(),
    currentUserId ? supabase.from("profiles").select("school_id").eq("id", currentUserId).maybeSingle() : Promise.resolve({ data: null }),
    listing.seller_id ? supabase.from("transaction_reviews").select("rating").eq("reviewed_user_id", listing.seller_id) : Promise.resolve({ data: [] }),
    listing.seller_id ? supabase.from("reviews").select("rating").eq("reviewed_user_id", listing.seller_id) : Promise.resolve({ data: [] }),
    listing.seller_id ? supabase.from("listings").select("id").eq("seller_id", listing.seller_id).eq("status", "available") : Promise.resolve({ data: [] }),
    currentUserId ? supabase.from("favorites").select("listing_id").eq("user_id", currentUserId).eq("listing_id", listing.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const reviewRows = (transactionReviews && transactionReviews.length > 0 ? transactionReviews : legacyReviews) || [];
  const reviewCount = reviewRows.length;
  const averageRating = reviewCount > 0 ? reviewRows.reduce((sum: number, row: any) => sum + Number(row.rating || 0), 0) / reviewCount : null;
  const sellerActiveListings = activeListings?.length || 0;

  const photos = (photosData || []).map((item: { url: string }) => item.url).filter(Boolean);
  const displayTitle = listing.title || "Anuncio";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const shareUrl = appUrl ? `${appUrl}/marketplace/listing/${listing.id}` : `/marketplace/listing/${listing.id}`;
  const currentSchoolId = viewerProfile?.school_id || "";
  const originalPrice = listing.original_price ?? listing.estimated_retail_price;
  const savings = typeof originalPrice === "number" && typeof listing.price === "number" ? Math.max(0, originalPrice - listing.price) : 0;

  let relatedQuery = supabase.from("listings").select("id, title, description, category, grade_level, condition, type, listing_type, isbn, price, original_price, estimated_retail_price, seller_id, school_id, status, created_at").eq("status", "available").neq("id", listing.id).limit(8);
  if (listing.isbn) relatedQuery = relatedQuery.eq("isbn", listing.isbn);
  else if (listing.category && listing.grade_level) relatedQuery = relatedQuery.eq("category", listing.category).eq("grade_level", listing.grade_level);
  else if (listing.category) relatedQuery = relatedQuery.eq("category", listing.category);
  else if (listing.grade_level) relatedQuery = relatedQuery.eq("grade_level", listing.grade_level);

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

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <ListingViewTracker listingId={listing.id} />
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
              {!isDonation && typeof originalPrice === "number" ? <p className="text-sm text-muted-foreground">Precio original: {formatPrice(originalPrice)}</p> : null}
              {!isDonation && savings > 0 ? <p className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">Ahorras {formatPrice(savings)}</p> : null}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {isOwnListing ? (
                <Link href={`/marketplace/edit/${listing.id}`}><Button className="w-full" variant="outline">Editar anuncio</Button></Link>
              ) : isAvailable ? (
                isDonation ? <RequestDonationButton listingId={listing.id} /> : <><BuyNowButton listingId={listing.id} currentPrice={listing.price} /><MakeOfferButton listingId={listing.id} currentPrice={listing.price} /></>
              ) : (
                <ListingStatusCard status={listing.status} />
              )}
              <FavoriteButton listingId={listing.id} initialIsFavorite={Boolean(favorite)} />
              <ShareListingButton title={displayTitle} url={shareUrl} />
            </div>
          </div>

          <SellerTrustCard
            sellerId={seller?.id}
            sellerName={seller?.business_name || seller?.full_name || "Usuario"}
            userType={seller?.user_type}
            isBusinessVerified={seller?.is_business_verified}
            averageRating={averageRating}
            reviewCount={reviewCount}
            activeListingsCount={sellerActiveListings}
          />

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Compra protegida en Wetudy</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>✓ Paga dentro de la plataforma para mantener historial y seguimiento.</li>
              <li>✓ El chat conserva ofertas, contraofertas y acuerdos.</li>
              <li>✓ Si algo falla, puedes abrir una incidencia desde tu cuenta.</li>
              <li>✓ Valora la operación al finalizar para reforzar la confianza de la comunidad.</li>
            </ul>
          </div>

          <ReportListingButton listingId={listing.id} />
        </div>
      </div>
    </div>
  );
}
